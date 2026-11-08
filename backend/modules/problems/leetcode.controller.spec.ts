import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { BadGatewayException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../../src/app.module';
import { LeetCodeService } from './leetcode.service';
import { ProblemsService } from './problems.service';

describe('LeetCode HTTP endpoints', () => {
  let app: INestApplication;
  const ADMIN = 'test-admin-key';

  const twoSum = {
    problem_number: 1,
    problem_link: 'https://leetcode.com/problems/two-sum/',
    problem_title: 'Two Sum',
    problem_difficulty: 'Easy',
    problem_tags: ['Array', 'Hash Table'],
  };
  const addTwoNumbers = {
    problem_number: 2,
    problem_link: 'https://leetcode.com/problems/add-two-numbers/',
    problem_title: 'Add Two Numbers',
    problem_difficulty: 'Medium',
    problem_tags: ['Linked List'],
  };

  //mock the services so these tests only check the http endpoints
  const leetcode = {
    fetchProblems: vi.fn(),
    fetchProblemBySlug: vi.fn(),
  };
  const problems = {
    findOrCreate: vi.fn(),
  };

  beforeAll(async () => {
    vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('SUPABASE_ANON_KEY', 'test-anon-key');
    vi.stubEnv('ADMIN_API_KEY', ADMIN);

    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(LeetCodeService).useValue(leetcode)
      .overrideProvider(ProblemsService).useValue(problems)
      .compile();
    app = module.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('ADMIN_API_KEY', ADMIN);
  });

  afterAll(async () => {
    await app?.close();
    vi.unstubAllEnvs();
  });

  const http = () => request(app.getHttpServer());

  it('GET /leetcode/problems uses a default limit of 5', async () => {
    leetcode.fetchProblems.mockResolvedValue([twoSum]);
    await http().get('/leetcode/problems').expect(200, [twoSum]);
    expect(leetcode.fetchProblems).toHaveBeenCalledWith(5);
    expect(problems.findOrCreate).not.toHaveBeenCalled();
  });

  it('GET /leetcode/problems accepts a limit', async () => {
    leetcode.fetchProblems.mockResolvedValue([twoSum]);
    await http().get('/leetcode/problems?limit=2').expect(200, [twoSum]);
    expect(leetcode.fetchProblems).toHaveBeenCalledWith(2);
  });

  it.each(['0', '21', 'abc', '1.5', '01', '999999999999999999999'])(
    'GET /leetcode/problems rejects limit=%s', async limit => {
      await http().get(`/leetcode/problems?limit=${limit}`).expect(400);
      expect(leetcode.fetchProblems).not.toHaveBeenCalled();
    },
  );

  it('GET /leetcode/problem/:slug returns one problem', async () => {
    leetcode.fetchProblemBySlug.mockResolvedValue(twoSum);
    await http().get('/leetcode/problem/two-sum').expect(200, twoSum);
    expect(leetcode.fetchProblemBySlug).toHaveBeenCalledWith('two-sum');
  });

  it('GET /leetcode/problem/:slug passes along a 404', async () => {
    leetcode.fetchProblemBySlug.mockRejectedValue(new NotFoundException('Problem not found'));
    await http().get('/leetcode/problem/missing-problem').expect(404);
  });

  it('POST /leetcode/import saves problems with the admin key', async () => {
    leetcode.fetchProblems.mockResolvedValue([twoSum, addTwoNumbers]);
    problems.findOrCreate.mockImplementation(async problem => problem);

    await http().post('/leetcode/import?limit=2')
      .set('x-admin-key', ADMIN)
      .expect(201, { processed: 2, problems: [twoSum, addTwoNumbers] });

    expect(leetcode.fetchProblems).toHaveBeenCalledWith(2);
    expect(problems.findOrCreate).toHaveBeenCalledTimes(2);
    expect(problems.findOrCreate).toHaveBeenNthCalledWith(1, twoSum);
    expect(problems.findOrCreate).toHaveBeenNthCalledWith(2, addTwoNumbers);
  });

  it('POST /leetcode/import uses 5 by default', async () => {
    leetcode.fetchProblems.mockResolvedValue([]);
    await http().post('/leetcode/import').set('x-admin-key', ADMIN)
      .expect(201, { processed: 0, problems: [] });
    expect(leetcode.fetchProblems).toHaveBeenCalledWith(5);
    expect(problems.findOrCreate).not.toHaveBeenCalled();
  });

  it('POST /leetcode/import needs the correct admin key', async () => {
    await http().post('/leetcode/import').expect(403);
    await http().post('/leetcode/import').set('x-admin-key', 'wrong-key').expect(403);
    await http().post('/leetcode/import').set('x-admin-key', 'test-admin-kex').expect(403);
    expect(leetcode.fetchProblems).not.toHaveBeenCalled();
    expect(problems.findOrCreate).not.toHaveBeenCalled();
  });

  it('POST /leetcode/import is blocked if the admin key is not configured', async () => {
    vi.stubEnv('ADMIN_API_KEY', '');
    await http().post('/leetcode/import').set('x-admin-key', ADMIN).expect(403);
    expect(leetcode.fetchProblems).not.toHaveBeenCalled();
  });

  it('POST /leetcode/import rejects an invalid limit', async () => {
    await http().post('/leetcode/import?limit=30').set('x-admin-key', ADMIN).expect(400);
    expect(leetcode.fetchProblems).not.toHaveBeenCalled();
  });

  it('POST /leetcode/import stops if Alfa fails', async () => {
    leetcode.fetchProblems.mockRejectedValue(new BadGatewayException('API unavailable'));
    await http().post('/leetcode/import').set('x-admin-key', ADMIN).expect(502);
    expect(problems.findOrCreate).not.toHaveBeenCalled();
  });

  it('POST /leetcode/import passes along database errors', async () => {
    leetcode.fetchProblems.mockResolvedValue([twoSum]);
    problems.findOrCreate.mockRejectedValue(new InternalServerErrorException('DB error'));
    await http().post('/leetcode/import').set('x-admin-key', ADMIN).expect(500);
    expect(problems.findOrCreate).toHaveBeenCalledWith(twoSum);
  });
});
