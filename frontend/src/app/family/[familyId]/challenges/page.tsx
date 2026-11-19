'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CreateChallengeForm } from '@/components/family/create-challenge-form';
import { createClient } from '@/lib/supabase/client';
import { apiFetch } from '@/lib/api/client';
import {
  getChallenges,
  deleteChallenge,
  type Challenge,
} from '@/lib/api/challenges';

// Check if the user is an owner or admin of this family.
async function canManageFamily(familyId: string) {
  const { data } = await createClient().auth.getUser();
  if (!data.user) return false;

  const [owner, admins] = await Promise.all([
    apiFetch<{ user_id: string }>(`/families/${familyId}/owner`),
    apiFetch<{ user_id: string }[]>(`/families/${familyId}/admins`),
  ]);

  return (
    owner.user_id === data.user.id ||
    admins.some((admin) => admin.user_id === data.user?.id)
  );
}

export default function FamilyChallengesPage() {
  const { familyId } = useParams<{ familyId: string }>();

  return <ChallengesContent key={familyId} familyId={familyId} />;
}

function ChallengesContent({ familyId }: { familyId: string }) {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [canManage, setCanManage] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Challenge | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    getChallenges(familyId)
      .then((data) => {
        if (active) setChallenges(data);
      })
      .catch(() => {
        if (active) setError('Could not load challenges.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    canManageFamily(familyId)
      .then((allowed) => {
        if (active) setCanManage(allowed);
      })
      .catch(() => {
        if (active) setCanManage(false);
      });

    return () => {
      active = false;
    };
  }, [familyId]);

  function handleSaved(saved: Challenge) {
    setChallenges((current) =>
      editing
        ? current.map((item) => (item.id === saved.id ? saved : item))
        : [saved, ...current],
    );

    setEditing(null);
    setShowForm(false);
    setError('');
    setLoading(false);
  }

  function openCreate() {
    setEditing(null);
    setShowForm(true);
  }

  function openEdit(challenge: Challenge) {
    setEditing(challenge);
    setShowForm(true);
  }

  async function handleDelete(challengeId: string) {
    if (!canManage || deletingId) return;

    if (!window.confirm('Delete this challenge?')) return;

    setDeletingId(challengeId);
    setError('');

    try {
      await deleteChallenge(familyId, challengeId);
      setChallenges((current) =>
        current.filter((item) => item.id !== challengeId),
      );
    } catch {
      setError('Could not delete the challenge.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Family Challenges</h1>
          <p className="text-muted-foreground">
            Weekly coding goals for your family.
          </p>
        </div>

        {canManage && !showForm && (
          <Button onClick={openCreate}>+ Create Challenge</Button>
        )}
      </div>

      {canManage && showForm && (
        <CreateChallengeForm
          key={editing?.id ?? 'new'}
          familyId={familyId}
          challenge={editing ?? undefined}
          onCreated={handleSaved}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}

      {loading && <p>Loading challenges...</p>}

      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}

      {!loading && !error && challenges.length === 0 && (
        <Card>
          <CardContent>
            <p>No challenges yet.</p>
          </CardContent>
        </Card>
      )}

      {!loading &&
        challenges.map((challenge) => (
          <Card key={challenge.id}>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>
                  {challenge.start_date} to {challenge.end_date}
                </CardTitle>

                {canManage && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEdit(challenge)}
                    >
                      Edit
                    </Button>

                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={deletingId !== null}
                      onClick={() => handleDelete(challenge.id)}
                    >
                      {deletingId === challenge.id ? 'Deleting...' : 'Delete'}
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4">
                <span className="text-easy">
                  Easy: {challenge.required_easy}
                </span>
                <span className="text-medium">
                  Medium: {challenge.required_medium}
                </span>
                <span className="text-hard">
                  Hard: {challenge.required_hard}
                </span>
              </div>

              <div>
                <p className="font-medium">Assigned Problems</p>
                <p className="text-muted-foreground">
                  {challenge.problem_order.length
                    ? challenge.problem_order.map((n) => `#${n}`).join(', ')
                    : 'No specific problems assigned.'}
                </p>
              </div>

              <div>
                <p className="font-medium">Reward</p>
                <p>{challenge.reward_description || 'None'}</p>
              </div>

              <div>
                <p className="font-medium">Punishment</p>
                <p>{challenge.punishment_description || 'None'}</p>
              </div>
            </CardContent>
          </Card>
        ))}
    </main>
  );
}
