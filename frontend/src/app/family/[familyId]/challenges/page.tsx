'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CreateChallengeForm } from '@/components/family/create-challenge-form';
import { getChallenges, type Challenge } from '@/lib/api/challenges';

export default function FamilyChallengesPage() {
  const { familyId } = useParams<{ familyId: string }>();

  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

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

    return () => {
      active = false;
    };
  }, [familyId]);

  function handleCreated(challenge: Challenge) {
    setChallenges((current) => [challenge, ...current]);
    setShowForm(false);
    setError('');
    setLoading(false);
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

        {!showForm && (
          <Button onClick={() => setShowForm(true)}>+ Create Challenge</Button>
        )}
      </div>

      {showForm && (
        <CreateChallengeForm
          familyId={familyId}
          onCreated={handleCreated}
          onCancel={() => setShowForm(false)}
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
        !error &&
        challenges.map((challenge) => (
          <Card key={challenge.id}>
            <CardHeader>
              <CardTitle>
                {challenge.start_date} to {challenge.end_date}
              </CardTitle>
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
                  {challenge.problem_order.length > 0
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
