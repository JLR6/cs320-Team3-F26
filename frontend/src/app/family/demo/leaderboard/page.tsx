'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { EditFamily } from '@/components/ui/edit-family';
import { Leaderboard, type LeaderboardData } from '@/components/ui/leaderboard';

// UI preview only: replace with family queries when backend integration is added.
const demoFamily: LeaderboardData = {
  family: { id: 'demo', name: 'CS320 Group 3' },
  owner: { family_id: 'demo', user_id: 'alex' },
  admins: [{ family_id: 'demo', user_id: 'sam' }],
  members: [
    { user_id: 'alex', username: 'Alex', points: 120 },
    { user_id: 'sam', username: 'Sam', points: 95 },
    { user_id: 'jordan', username: 'Jordan', points: 80 },
    { user_id: 'taylor', username: 'Taylor', points: 80 },
  ],
};

export default function FamilyLeaderboardPage() {
  const [data, setData] = useState(demoFamily);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState('');

  return (
    <main className="mx-auto w-full max-w-3xl p-4 sm:p-6">
      <p className="mb-4 text-sm text-muted-foreground">
        Demo family with sample scores. Changes last only until you reload.
      </p>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{data.family.name}</p>
          <h1 className="text-2xl font-bold">Leaderboard</h1>
        </div>
        <Button variant="outline" onClick={() => setOpen(true)}>
          Edit Family
        </Button>
      </div>
      <Leaderboard data={data} />
      {notice && (
        <p role="status" className="mt-4 text-sm">
          {notice}
        </p>
      )}
      <EditFamily
        data={{ ...data, admins: data.admins ?? [] }}
        currentUserId={data.owner.user_id}
        open={open}
        onOpenChange={setOpen}
        onUpdateFamily={async (_, patch) => {
          setData((current) => ({
            ...current,
            family: { ...current.family, ...patch },
          }));
        }}
        onPromoteAdmin={async (familyId, { user_id }) => {
          setData((current) => ({
            ...current,
            admins: [
              ...(current.admins ?? []),
              { family_id: familyId, user_id },
            ],
          }));
        }}
        onDemoteAdmin={async (_, userId) => {
          setData((current) => ({
            ...current,
            admins: current.admins?.filter((admin) => admin.user_id !== userId),
          }));
        }}
        onRemoveMember={async (_, userId) => {
          setData((current) => ({
            ...current,
            members: current.members.filter(
              (member) => member.user_id !== userId,
            ),
            admins: current.admins?.filter((admin) => admin.user_id !== userId),
          }));
        }}
        onInvite={async (_, emails) => {
          setNotice(
            `Demo: invitations previewed for ${emails.join(', ')}. No emails were sent.`,
          );
        }}
      />
    </main>
  );
}
