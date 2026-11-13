import { apiFetch } from './client';

export interface Challenge {
  id: string;
  family_id: string;
  required_easy: number;
  required_medium: number;
  required_hard: number;
  start_date: string;
  end_date: string;
  reward_description: string;
  punishment_description: string;
  problem_order: number[];
  created_by: string;
  created_at: string | null;
  updated_at: string | null;
}

export type ChallengeInput = Partial<
  Pick<
    Challenge,
    | 'required_easy'
    | 'required_medium'
    | 'required_hard'
    | 'start_date'
    | 'end_date'
    | 'reward_description'
    | 'punishment_description'
    | 'problem_order'
  >
>;

export function getChallenges(familyId: string) {
  return apiFetch<Challenge[]>(`/families/${familyId}/challenges`);
}

export function createChallenge(familyId: string, input: ChallengeInput) {
  return apiFetch<Challenge>(`/families/${familyId}/challenges`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateChallenge(
  familyId: string,
  challengeId: string,
  input: ChallengeInput,
) {
  return apiFetch<Challenge>(
    `/families/${familyId}/challenges/${challengeId}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export function deleteChallenge(familyId: string, challengeId: string) {
  return apiFetch<void>(`/families/${familyId}/challenges/${challengeId}`, {
    method: 'DELETE',
  });
}
