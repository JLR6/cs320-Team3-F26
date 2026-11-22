
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SupabaseService } from '../../src/integrations/supabase/supabase.service';
import { UserProblemsService } from './user_problems.service';
import { SUBMISSION_STATES } from './user_problems.service';

interface user_problem {
    user_id: string;
    problem_number: number;
    created_at: string;
    updated_at: string;
    submission_state: SUBMISSION_STATES;
}

describe('UserProblemsService', () => {
    const fetchMock = vi.fn<typeof fetch>();
    let service: UserProblemsService;
    let mock_user_problems: Array<user_problem>;
    let mock_token: string;

    beforeEach(() => {
        vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:54321');
        vi.stubEnv('SUPABASE_ANON_KEY', 'test-anon-key');
        vi.stubGlobal('fetch', fetchMock);
        service = new UserProblemsService(new SupabaseService());
        mock_token = 'test-token';

        // Supabase returns back only data associated with the userId given
        // Use .filter to only include problems for the specific user when mocking the response
        mock_user_problems = [

            {
                user_id: 'user1',
                problem_number: 1,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                submission_state: SUBMISSION_STATES.COMPLETED
            },
            {
                user_id: 'user1',
                problem_number: 2,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                submission_state: SUBMISSION_STATES.INCOMPLETE
            },
            {
                user_id: 'user2',
                problem_number: 3,
                created_at: new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000 * 2).toISOString(),
                updated_at: new Date().toISOString(),
                submission_state: SUBMISSION_STATES.COMPLETED
            },
            {
                user_id: 'user2',
                problem_number: 4,
                created_at: new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000 * 0.5).toISOString(),
                updated_at: new Date().toISOString(),
                submission_state: SUBMISSION_STATES.INCOMPLETE 
            }

        ];
  });

    afterEach(() => {
        vi.resetAllMocks();
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
  });

  // <--------> Get All Tests <-------->

  it('should return all user problems', async () => {
    fetchMock.mockResolvedValueOnce(Response.json(mock_user_problems.filter(p => p.user_id === 'user1')));
    const result = await service.getAllUserProblems(mock_token, 'user1');
    expect(result).toEqual(mock_user_problems.filter(p => p.user_id === 'user1'));
  });

  it('should return empty when no user problems exist | return all', async () => {
    fetchMock.mockResolvedValueOnce(Response.json([]));
    const result = await service.getAllUserProblems(mock_token, 'user3');
    expect(result).toEqual([]);
  });

  it('should throw an error if the user is not authenticated | return all', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ error: 'Unauthorized' }, { status: 401 }));
    await expect(service.getAllUserProblems(mock_token, 'user1')).rejects.toThrow();
  });

  // <--------> Get Weekly Tests <-------->

  it('should return this weeks problems', async () => {
    const now = new Date();
    const time_since_sunday_reset = new Date(now);
    time_since_sunday_reset.setDate(now.getDate() - now.getDay());
    time_since_sunday_reset.setHours(23, 59, 59, 0);

    fetchMock.mockResolvedValueOnce(Response.json(mock_user_problems.filter(p => p.user_id === 'user2' && new Date(p.created_at).getTime() > time_since_sunday_reset.getTime())));
    const result = await service.getWeeklyProblems(mock_token, 'user2');
    expect(result).toEqual(mock_user_problems.filter(p => p.user_id === 'user2' && new Date(p.created_at).getTime() > time_since_sunday_reset.getTime()));
  });

  it('should return empty when no user problems exist | return weekly', async () => {
    fetchMock.mockResolvedValueOnce(Response.json([]));
    const result = await service.getWeeklyProblems(mock_token, 'user3');
    expect(result).toEqual([]);
  });

  it('should throw an error if the user is not authenticated | return weekly', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ error: 'Unauthorized' }, { status: 401 }));
    await expect(service.getWeeklyProblems(mock_token, 'user2')).rejects.toThrow();
  });

  // <--------> Create Weekly Tests <-------->

  it('should create a new user problem', async () => {
    const date = new Date().toISOString();
    const expected_problem = {
      user_id: 'user1',
      problem_number: 1001,
      updated_at: date,
      created_at: date,
      submission_state: SUBMISSION_STATES.COMPLETED
    };
    fetchMock.mockResolvedValueOnce(Response.json(expected_problem));
    const result = await service.create(mock_token, 'user1', 1001, SUBMISSION_STATES.COMPLETED);
    expect(result).toEqual(expected_problem);
  });

  it('should throw an error if the problem does not exist | create', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ error: 'Problem not found' }, { status: 404 }));
    await expect(service.create(mock_token, 'user1', 1001, SUBMISSION_STATES.COMPLETED)).rejects.toThrow();
  });

  it('should throw an error if the user is not authenticated | create', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ error: 'Unauthorized' }, { status: 401 }));
    await expect(service.create(mock_token, 'user1', 1001, SUBMISSION_STATES.COMPLETED)).rejects.toThrow();
  });

  // <--------> Update Weekly Tests <-------->

  it('should update an existing problem', async () => {
    const date = new Date().toISOString();
    const expected_problem = {
      user_id: 'user1',
      problem_number: 1001,
      updated_at: date,
      created_at: date,
      submission_state: SUBMISSION_STATES.INCOMPLETE
    };
    fetchMock.mockResolvedValueOnce(Response.json(expected_problem));
    const result = await service.update(mock_token, 'user1', 1001, SUBMISSION_STATES.INCOMPLETE);
    expect(result).toEqual(expected_problem);
  });

  it('should throw an error if the problem does not exist | update', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ error: 'Problem not found' }, { status: 404 }));
    await expect(service.update(mock_token, 'user1', 1001, SUBMISSION_STATES.INCOMPLETE)).rejects.toThrow();
  });

  it('should throw an error if the user is not authenticated | update', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ error: 'Unauthorized' }, { status: 401 }));
    await expect(service.update(mock_token, 'user1', 1001, SUBMISSION_STATES.INCOMPLETE)).rejects.toThrow();
  });

  // <--------> Delete Weekly Tests <-------->

  it('should delete an existing problem', async () => {
    const expected_problem = {
      user_id: 'user1',
      problem_number: 1001,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      submission_state: SUBMISSION_STATES.INCOMPLETE
    };
    fetchMock.mockResolvedValueOnce(Response.json(expected_problem));
    const result = await service.delete(mock_token, 'user1', 1001);
    expect(result).toEqual(expected_problem);
  });

  it('should throw an error if the problem does not exist | delete', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ error: 'Problem not found' }, { status: 404 }));
    await expect(service.delete(mock_token, 'user1', 1001)).rejects.toThrow();
  });

  it('should throw an error if the user is not authenticated | delete', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ error: 'Unauthorized' }, { status: 401 }));
    await expect(service.delete(mock_token, 'user1', 1001)).rejects.toThrow();
  });

});