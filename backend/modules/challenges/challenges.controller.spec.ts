/**
 * HTTP tests for the /families/:familyId/challenges routes.
 *
 * The real ChallengesService is replaced with a fake (vi.fn() for each method), so these
 * tests only check the controller's job: routing, reading the Bearer token, validating
 * the URL and body, and returning the right status codes. Database behavior is covered in
 * challenges.service.spec.ts. Requests are sent with Supertest against the real Nest app.
 */
import 'reflect-metadata';
import {
  BadRequestException,
  ForbiddenException,
  type INestApplication,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../../src/app.module';
import { ChallengesService } from './challenges.service';

describe('Challenges HTTP endpoints', () => {
  let app: INestApplication;
  const TOKEN = 'user-token';
  const AUTH = `Bearer ${TOKEN}`;
  const FAMILY_ID = '11111111-1111-4111-8111-111111111111';
  const CHALLENGE_ID = '33333333-3333-4333-8333-333333333333';
  const BASE = `/families/${FAMILY_ID}/challenges`;
  const ONE = `${BASE}/${CHALLENGE_ID}`;
  const challenge = { id: CHALLENGE_ID, family_id: FAMILY_ID, problem_order: [1, 2] };

  const service = { create: vi.fn(), findAll: vi.fn(), findOne: vi.fn(), update: vi.fn(), remove: vi.fn() };

  beforeAll(async () => {
    vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('SUPABASE_ANON_KEY', 'test-anon-key');
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ChallengesService).useValue(service).compile();
    app = module.createNestApplication();
    await app.init();
  });

  beforeEach(() => { vi.resetAllMocks(); });
  afterAll(async () => {
    await app?.close();
    vi.unstubAllEnvs();
  });

  const http = () => request(app.getHttpServer());
  const send = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string) =>
    method === 'POST' ? http().post(path)
      : method === 'PATCH' ? http().patch(path)
      : method === 'DELETE' ? http().delete(path)
      : http().get(path);

  // Every route must refuse requests without a valid "Bearer <token>" header, before the
  // service is ever called.
  describe('authentication', () => {
    it.each([
      ['POST', BASE],
      ['GET', BASE],
      ['GET', ONE],
      ['PATCH', ONE],
      ['DELETE', ONE],
    ] as const)('%s %s returns 401 without a Bearer token', async (method, path) => {
      await send(method, path).send({ required_easy: 1 }).expect(401);
      for (const fn of Object.values(service)) expect(fn).not.toHaveBeenCalled();
    });

    it('rejects a header that is not a Bearer token', async () => {
      await http().get(BASE).set('Authorization', `Basic ${TOKEN}`).expect(401);
      expect(service.findAll).not.toHaveBeenCalled();
    });
  });

  // Ids in the URL must be UUIDs; anything else is rejected with 400 before the service runs.
  describe('URL validation', () => {
    it.each([
      ['POST', '/families/abc/challenges'],
      ['GET', '/families/abc/challenges'],
      ['GET', `${BASE}/abc`],
      ['PATCH', `${BASE}/abc`],
      ['DELETE', `${BASE}/abc`],
      ['GET', `/families/abc/challenges/${CHALLENGE_ID}`],
    ] as const)('%s %s returns 400 for a non-UUID id', async (method, path) => {
      await send(method, path).set('Authorization', AUTH).send({ required_easy: 1 }).expect(400);
      for (const fn of Object.values(service)) expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('POST /families/:familyId/challenges', () => {
    it('creates a challenge with defaults filled in and returns 201', async () => {
      service.create.mockResolvedValue(challenge);
      await http().post(BASE).set('Authorization', AUTH)
        .send({ required_easy: 2, start_date: '2026-11-02', problem_order: [1, 2] })
        .expect(201, challenge);
      expect(service.create).toHaveBeenCalledWith(TOKEN, FAMILY_ID, {
        required_easy: 2,
        required_medium: 0,
        required_hard: 0,
        start_date: '2026-11-02',
        end_date: '2026-11-08',
        punishment_description: '',
        reward_description: '',
        problem_order: [1, 2],
      });
    });

    it('returns 400 for an invalid body', async () => {
      await http().post(BASE).set('Authorization', AUTH)
        .send({ start_date: '2026-11-02', end_date: '2026-11-20' }).expect(400);
      expect(service.create).not.toHaveBeenCalled();
    });

    it('passes through a 403 for regular members', async () => {
      service.create.mockRejectedValue(new ForbiddenException('Only the family owner or an admin can do this'));
      await http().post(BASE).set('Authorization', AUTH).send({ start_date: '2026-11-02' }).expect(403);
    });
  });

  describe('GET /families/:familyId/challenges', () => {
    it('lists challenges', async () => {
      service.findAll.mockResolvedValue([challenge]);
      await http().get(BASE).set('Authorization', AUTH).expect(200, [challenge]);
      expect(service.findAll).toHaveBeenCalledWith(TOKEN, FAMILY_ID);
    });

    it('passes through a 404 for non-members', async () => {
      service.findAll.mockRejectedValue(new NotFoundException('Family not found'));
      await http().get(BASE).set('Authorization', AUTH).expect(404);
    });
  });

  describe('GET /families/:familyId/challenges/:challengeId', () => {
    it('returns one challenge', async () => {
      service.findOne.mockResolvedValue(challenge);
      await http().get(ONE).set('Authorization', AUTH).expect(200, challenge);
      expect(service.findOne).toHaveBeenCalledWith(TOKEN, FAMILY_ID, CHALLENGE_ID);
    });
  });

  describe('PATCH /families/:familyId/challenges/:challengeId', () => {
    it('updates the challenge', async () => {
      service.update.mockResolvedValue({ ...challenge, required_hard: 2 });
      await http().patch(ONE).set('Authorization', AUTH).send({ required_hard: 2 }).expect(200);
      expect(service.update).toHaveBeenCalledWith(TOKEN, FAMILY_ID, CHALLENGE_ID, { required_hard: 2 });
    });

    it('returns 400 for an empty body', async () => {
      await http().patch(ONE).set('Authorization', AUTH).send({}).expect(400);
      expect(service.update).not.toHaveBeenCalled();
    });

    it('passes through a 400 from the service (problem not in the problems table)', async () => {
      service.update.mockRejectedValue(
        new BadRequestException('Every problem in problem_order must exist in the problems table'),
      );
      await http().patch(ONE).set('Authorization', AUTH).send({ problem_order: [99999] }).expect(400);
    });
  });

  describe('DELETE /families/:familyId/challenges/:challengeId', () => {
    it('deletes the challenge and returns 204 with no body', async () => {
      service.remove.mockResolvedValue(undefined);
      const res = await http().delete(ONE).set('Authorization', AUTH).expect(204);
      expect(res.text).toBe('');
      expect(service.remove).toHaveBeenCalledWith(TOKEN, FAMILY_ID, CHALLENGE_ID);
    });

    it('passes through a 403 for regular members', async () => {
      service.remove.mockRejectedValue(new ForbiddenException('Only the family owner or an admin can do this'));
      await http().delete(ONE).set('Authorization', AUTH).expect(403);
    });
  });
});
