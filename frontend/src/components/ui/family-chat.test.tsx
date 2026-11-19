import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FamilyChat } from './family-chat';
import type { ComponentProps } from 'react';

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
    chat: { props: null as ComponentProps<typeof FamilyChat> | null },
  };
});

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: m.fromMock,
  }),
}));

vi.mock('@/components/realtime-chat', () => ({
  RealtimeChat: (props: ComponentProps<typeof FamilyChat>) => {
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

    await waitFor(() => expect(m.chat.props.messages).toEqual([message]));

    expect(m.fromMock).toHaveBeenCalledWith('family_messages');
    expect(m.selectMock).toHaveBeenCalledWith('*');
    expect(m.eqMock).toHaveBeenCalledWith('family_id', 'family1');
    expect(m.orderMock).toHaveBeenCalledWith('created_at', { ascending: true });
    expect(m.chat.props.roomName).toBe('family-family1');
    expect(m.chat.props.username).toBe('testuser');
  });

  it('Handles new messages correctly', async () => {
    m.orderMock.mockResolvedValueOnce({ data: [], error: null });
    render(<FamilyChat familyId="family1" username="testuser" />);

    await waitFor(() => expect(m.chat.props.messages).toEqual([]));

    const newMessages = [
      { ...message },
      { ...message, id: '2', user: { name: 'otheruser' } },
    ];

    await m.chat.props.onMessage(newMessages);

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

    await waitFor(() => expect(m.chat.props.messages).toEqual([]));

    const newMessages = [{ ...message, id: '2', user: { name: 'otheruser' } }];

    await m.chat.props.onMessage(newMessages);

    expect(m.upsertMock).not.toHaveBeenCalled();
  });
});
