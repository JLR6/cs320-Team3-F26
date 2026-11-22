import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FamilyChat } from './family-chat';

const m = vi.hoisted(() => {
  const orderMock = vi.fn();
  const eqMock = vi.fn(() => ({ order: orderMock }));
  const selectMock = vi.fn(() => ({ eq: eqMock }));
  const upsertMock = vi.fn();
  const fromMock = vi.fn(() => ({ select: selectMock, upsert: upsertMock }));
  return {
    upsertMock,
    fromMock,
    selectMock,
    eqMock,
    orderMock,
    chat: { props: null as RealtimeChatProps | null },
  };
});

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: m.fromMock,
  }),
}));

vi.mock('@/components/realtime-chat', () => ({
  RealtimeChat: (props: RealtimeChatProps) => {
    m.chat.props = props;
    return <div data-testid="realtime-chat" />;
  },
}));

const message = {
  id: '1',
  user: { name: 'testuser' },
  content: 'Hello, world!',
  createdAt: new Date().toISOString(),
};

type ChatMessage = typeof message;

type RealtimeChatProps = {
  messages: ChatMessage[];
  roomName: string;
  username: string;
  onMessage: (messages: ChatMessage[]) => void | Promise<void>;
}

const db = {
  id: '1',
  username: 'testuser',
  content: 'Hello, world!',
  created_at: message.createdAt,
};

beforeEach(() => {
  vi.clearAllMocks();
  m.upsertMock.mockResolvedValue({ error: null });
});

describe('FamilyChat', () => {
  it('Maps initial messages correctly', async () => {
    m.orderMock.mockResolvedValueOnce({ data: [db], error: null });
    render(<FamilyChat familyId="family1" username="testuser" />);

    await waitFor(() => expect(getChatProps().messages).toEqual([message]));

    expect(m.fromMock).toHaveBeenCalledWith('family_messages');
    expect(m.selectMock).toHaveBeenCalledWith('*');
    expect(m.eqMock).toHaveBeenCalledWith('family_id', 'family1');
    expect(m.orderMock).toHaveBeenCalledWith('created_at', { ascending: true });
    expect(getChatProps().roomName).toBe('family-family1');
    expect(getChatProps().username).toBe('testuser');
  });

  it('Handles new messages correctly', async () => {
    m.orderMock.mockResolvedValueOnce({ data: [], error: null });
    render(<FamilyChat familyId="family1" username="testuser" />);

    await waitFor(() => expect(getChatProps().messages).toEqual([]));

    const newMessages = [
      { ...message },
      { ...message, id: '2', user: { name: 'otheruser' } },
    ];

    await getChatProps().onMessage(newMessages);

    expect(m.upsertMock).toHaveBeenCalledWith([
      {
        id: '1',
        family_id: 'family1',
        username: 'testuser',
        content: 'Hello, world!',
        created_at: message.createdAt,
      },
    ]);
  });

  it('Does not upsert messages from other users', async () => {
    m.orderMock.mockResolvedValueOnce({ data: [], error: null });
    render(<FamilyChat familyId="family1" username="testuser" />);

    await waitFor(() => expect(getChatProps().messages).toEqual([]));

    const newMessages = [{ ...message, id: '2', user: { name: 'otheruser' } }];

    await getChatProps().onMessage(newMessages);

    expect(m.upsertMock).not.toHaveBeenCalled();
  });
});


// Helper func to check chat props
function getChatProps() {
  if (!m.chat.props) {
    throw new Error('Chat props are not set');
  }
  return m.chat.props;
}