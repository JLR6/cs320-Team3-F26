'use client';

import { useCallback, useEffect, useState } from 'react';
import { RealtimeChat } from '@/components/realtime-chat';
import { createClient } from '@/lib/supabase/client';
import { ChatMessage } from '@/hooks/use-realtime-chat';

const supabase = createClient();

export const FamilyChat = ({
  familyId,
  username,
}: {
  familyId: string;
  username: string;
}) => {
  const [initialMessages, setInitialMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    let cancelled = false;

    supabase
      .from('family_messages')
      .select('*')
      .eq('family_id', familyId)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (!cancelled) {
          if (error) {
            console.error('Error fetching family messages:', error);
          }
          const messages =
            data?.map((message) => ({
              id: message.id,
              user: { name: message.username },
              content: message.content,
              createdAt: message.created_at,
            })) || [];
          setInitialMessages(messages);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [familyId]);

  const handleNewMessages = useCallback(
    async (messages: ChatMessage[]) => {
      const filteredMessages = messages.filter(
        (message) => message.user.name === username,
      );

      if (filteredMessages.length === 0) {
        return;
      }

      await supabase.from('family_messages').upsert(
        filteredMessages.map((message) => ({
          id: message.id,
          family_id: familyId,
          username: message.user.name,
          content: message.content,
          created_at: message.createdAt,
        })),
      );
    },
    [username, familyId],
  );

  return (
    <RealtimeChat
      roomName={`family-${familyId}`}
      username={username}
      onMessage={handleNewMessages}
      messages={initialMessages}
    />
  );
};
