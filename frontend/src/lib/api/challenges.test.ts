import { describe, it, expect, vi, beforeEach } from 'vitest';

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }));
// mock the API so tests don't make real requests
vi.mock('./client', () => ({ apiFetch }));

import { getChallenges, createChallenge } from './challenges';

const familyId = '11111111-1111-4111-8111-111111111111';

describe('challenges api', () => {
  beforeEach(() => vi.clearAllMocks());
  // check that challenges are fetched from the right family
  it('gets challenges for the correct family', async () => {
    const challenges = [{ id: 'challenge1' }];
    apiFetch.mockResolvedValue(challenges);
    expect(await getChallenges(familyId)).toEqual(challenges);
    expect(apiFetch).toHaveBeenCalledWith(`/families/${familyId}/challenges`);
  });

  it('returns an empty list when there are no challenges', async () => {
    apiFetch.mockResolvedValue([]);
    expect(await getChallenges(familyId)).toEqual([]);
  });

  // check that creating a challenge sends the right data
  it('creates a challenge with a POST request', async () => {
    const input = {
      required_easy: 2,
      required_medium: 1,
      required_hard: 0,
      problem_order: [1, 15],
    };
    apiFetch.mockResolvedValue({ id: 'challenge1' });
    await createChallenge(familyId, input);
    expect(apiFetch).toHaveBeenCalledWith(`/families/${familyId}/challenges`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  });

  // make sure errors are passed back instead of ignored
  it('passes along API errors', async () => {
    apiFetch.mockRejectedValue(new Error('Request failed'));
    await expect(getChallenges(familyId)).rejects.toThrow('Request failed');
  });
});