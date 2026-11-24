'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError } from '@/lib/api/client';
import {
  createChallenge,
  updateChallenge,
  type Challenge,
  type ChallengeInput,
} from '@/lib/api/challenges';

type Props = {
  familyId: string;
  challenge?: Challenge;
  onCreated: (challenge: Challenge) => void;
  onCancel: () => void;
};

function addSixDays(date: string) {
  const time = Date.parse(`${date}T00:00:00Z`);
  return new Date(time + 6 * 86400000).toISOString().slice(0, 10);
}

export function CreateChallengeForm({
  familyId,
  challenge,
  onCreated,
  onCancel,
}: Props) {
  const [easy, setEasy] = useState(String(challenge?.required_easy ?? 0));
  const [medium, setMedium] = useState(String(challenge?.required_medium ?? 0));
  const [hard, setHard] = useState(String(challenge?.required_hard ?? 0));
  const [startDate, setStartDate] = useState(
    challenge?.start_date ?? new Date().toISOString().slice(0, 10),
  );
  const [endDate, setEndDate] = useState(
    () =>
      challenge?.end_date ?? addSixDays(new Date().toISOString().slice(0, 10)),
  );
  const [problems, setProblems] = useState(
    challenge?.problem_order.join(', ') ?? '',
  );
  const [reward, setReward] = useState(challenge?.reward_description ?? '');
  const [punishment, setPunishment] = useState(
    challenge?.punishment_description ?? '',
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');

    const counts = [easy, medium, hard];

    if (counts.some((value) => !/^\d+$/.test(value) || Number(value) > 100)) {
      setError('Problem requirements must be between 0 and 100.');
      return;
    }

    const days =
      (Date.parse(`${endDate}T00:00:00Z`) -
        Date.parse(`${startDate}T00:00:00Z`)) /
      86400000;

    if (!Number.isFinite(days) || days < 0 || days > 6) {
      setError('Challenges must last between 1 and 7 days.');
      return;
    }

    const items = problems.trim() ? problems.trim().split(/[\s,]+/) : [];

    const problemNumbers = items.map(Number);

    if (
      problemNumbers.length > 50 ||
      problemNumbers.some(
        (n) => !Number.isInteger(n) || n < 1 || n > 2147483647,
      ) ||
      new Set(problemNumbers).size !== problemNumbers.length
    ) {
      setError('Enter up to 50 unique, positive problem numbers.');
      return;
    }

    setSaving(true);

    try {
      const input: ChallengeInput = {
        required_easy: Number(easy),
        required_medium: Number(medium),
        required_hard: Number(hard),
        start_date: startDate,
        end_date: endDate,
        problem_order: problemNumbers,
        reward_description: reward.trim(),
        punishment_description: punishment.trim(),
      };

      const saved = challenge
        ? await updateChallenge(familyId, challenge.id, input)
        : await createChallenge(familyId, input);

      onCreated(saved);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError('Only family owners and admins can manage challenges.');
      } else if (err instanceof ApiError && err.status === 401) {
        setError('Please log in to create a challenge.');
      } else if (err instanceof ApiError && err.status === 400) {
        setError(
          'Check your dates and problem numbers. Assigned problems must exist in the database.',
        );
      } else {
        setError(
          challenge
            ? 'Could not update the challenge. Please try again.'
            : 'Could not create the challenge. Please try again.',
        );
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {challenge ? 'Edit Challenge' : 'Create Challenge'}
        </CardTitle>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <h3 className="font-medium">Problem Requirements</h3>
            <p className="text-sm text-muted-foreground">
              How many problems should each member solve?
            </p>

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Easy', value: easy, set: setEasy },
                { label: 'Medium', value: medium, set: setMedium },
                { label: 'Hard', value: hard, set: setHard },
              ].map((field) => (
                <div className="space-y-2" key={field.label}>
                  <Label htmlFor={field.label}>{field.label}</Label>
                  <Input
                    id={field.label}
                    type="number"
                    min="0"
                    max="100"
                    required
                    value={field.value}
                    onChange={(e) => field.set(e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                required
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (e.target.value) {
                    setEndDate(addSixDays(e.target.value));
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="problems">Assigned LeetCode Problems</Label>
            <Input
              id="problems"
              placeholder="1, 15, 200"
              value={problems}
              onChange={(e) => setProblems(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Optional. Enter problem numbers separated by commas. Problems must
              exist in the database.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reward">Reward</Label>
            <Input
              id="reward"
              placeholder="Winner chooses next week's challenge"
              maxLength={500}
              value={reward}
              onChange={(e) => setReward(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="punishment">Punishment</Label>
            <Input
              id="punishment"
              placeholder="Lose 1 point for not completing the challenge"
              maxLength={500}
              value={punishment}
              onChange={(e) => setPunishment(e.target.value)}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? 'Saving...'
                : challenge
                  ? 'Save Changes'
                  : 'Create Challenge'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
