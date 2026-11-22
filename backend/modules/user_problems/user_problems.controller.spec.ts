import 'reflect-metadata';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../../src/app.module';
import { UserProblemsService } from './user_problems.service';
import { SUBMISSION_STATES } from './user_problems.service';

interface user_problem {
    user_id: string;
    problem_number: number;
    created_at: string;
    updated_at: string;
    submission_state: SUBMISSION_STATES;
}

describe('UserProblemsController', () => {
  let app: INestApplication;
  const id = '11111111-1111-4111-8111-111111111111';
  const user_problem: user_problem = {
    user_id: id,
    problem_number: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    submission_state: SUBMISSION_STATES.COMPLETED,
  };
  const service = {
    getAllUserProblems: vi.fn(), getWeeklyProblems: vi.fn(), create: vi.fn(),
    update: vi.fn(), delete: vi.fn(),
  };

  beforeAll(async () => {
    vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('SUPABASE_ANON_KEY', 'test-anon-key');
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).overrideProvider(UserProblemsService).useValue(service).compile();
    app = module.createNestApplication();
    await app.init();
  });

  beforeEach(() => { vi.resetAllMocks(); });
  afterAll(async () => {
    await app?.close();
    vi.unstubAllEnvs();
  });

  // <--------> Get All Tests <-------->

  it('GET /user-problems/:userId returns a list for a specific user', async () => {
    service.getAllUserProblems.mockResolvedValue([user_problem]);
    await request(app.getHttpServer()).get(`/user-problems/${id}`)
      .set('Authorization', 'Bearer user-token').expect(200, [user_problem]);
    expect(service.getAllUserProblems).toHaveBeenCalledWith('user-token', id);
  });

  it('GET /user-problems/:userId/ requires authentication', async () => {
    await request(app.getHttpServer()).get(`/user-problems/${id}`)
      .expect(401);
  });

  // <--------> Get weekly Tests <-------->

  it('GET /user-problems/:userId/weekly returns a list of weekly problems for a specific user', async () => {
    service.getWeeklyProblems.mockResolvedValue([user_problem]);
    await request(app.getHttpServer()).get(`/user-problems/${id}/weekly`)
      .set('Authorization', 'Bearer user-token').expect(200, [user_problem]);
    expect(service.getWeeklyProblems).toHaveBeenCalledWith('user-token', id);
  });

  it('GET /user-problems/:userId/weekly requires authentication', async () => {
    await request(app.getHttpServer()).get(`/user-problems/${id}/weekly`)
      .expect(401);
  });

  // <--------> Create Tests <-------->

  it('POST /user-problems/:userId/:problem_number creates a new user problem', async () => {
    service.create.mockResolvedValue(user_problem);
    await request(app.getHttpServer()).post(`/user-problems/${id}/${user_problem.problem_number}`)
      .set('Authorization', 'Bearer user-token')
      .send({ submission_state: user_problem.submission_state })
      .expect(201, user_problem);
    expect(service.create).toHaveBeenCalledWith('user-token', id, user_problem.problem_number, user_problem.submission_state);
  });

  it('POST /user-problems/:userId/:problem_number requires authentication', async () => {
    await request(app.getHttpServer()).post(`/user-problems/${id}/${user_problem.problem_number}`)
      .send({ submission_state: user_problem.submission_state })
      .expect(401);
  });

  // <--------> Update Tests <-------->

  it('PATCH /user-problems/:userId/:problem_number updates an existing user problem', async () => {
    service.update.mockResolvedValue(user_problem);
    await request(app.getHttpServer()).patch(`/user-problems/${id}/${user_problem.problem_number}`)
      .set('Authorization', 'Bearer user-token')
      .send({ submission_state: user_problem.submission_state })
      .expect(200, user_problem);
    expect(service.update).toHaveBeenCalledWith('user-token', id, user_problem.problem_number, user_problem.submission_state);
  });

  it('PATCH /user-problems/:userId/:problem_number requires authentication', async () => {
    await request(app.getHttpServer()).patch(`/user-problems/${id}/${user_problem.problem_number}`)
      .send({ submission_state: user_problem.submission_state })
      .expect(401);
  });

  // <--------> Delete Tests <-------->

  it('DELETE /user-problems/:userId/:problem_number deletes an existing user problem', async () => {
    service.delete.mockResolvedValue(user_problem);
    await request(app.getHttpServer()).delete(`/user-problems/${id}/${user_problem.problem_number}`)
      .set('Authorization', 'Bearer user-token')
      .expect(200, user_problem);
    expect(service.delete).toHaveBeenCalledWith('user-token', id, user_problem.problem_number);
  });

  it('DELETE /user-problems/:userId/:problem_number requires authentication', async () => {
    await request(app.getHttpServer()).delete(`/user-problems/${id}/${user_problem.problem_number}`)
      .expect(401);
  });

});