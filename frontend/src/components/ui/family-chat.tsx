'use client'

import { useEffect, useState } from 'react';
import { RealtimeChat } from '@/components/realtime-chat';
import { createClient } from '@/lib/supabase/client';
import { ChatMessage } from '@/hooks/use-realtime-chat';

const supabase = createClient();

export const FamilyChat = ({ familyId, username }: { familyId: string; username: string }) => {
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
                    } else {
                        setInitialMessages(data as ChatMessage[]);
                    }
                }
                setInitialMessages(data as ChatMessage[]);
            });

        return () => {
            cancelled = true;
        };
    }, [familyId]); 

    const handleNewMessages = async (messages: ChatMessage[]) => {
        await supabase.from('family_messages').upsert(
            messages.map((message) => ({
                id: message.id,
                family_id: familyId,
                username: username,
                content: message.content,
                created_at: message.createdAt,
            }))
        );
    }
    
    return (
        <RealtimeChat
            roomName={`family-${familyId}`}
            username={username}
            onMessage={handleNewMessages}
            messages={initialMessages}
        />
    );
}
