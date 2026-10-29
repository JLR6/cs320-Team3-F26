import 'reflect-metadata';
import {
  ConflictException,
  ForbiddenException,
  type INestApplication,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../../src/app.module';
import { FamiliesService } from './families.service';

describe('Families HTTP endpoints', () => {
  let app: INestApplication;
  const TOKEN = 'user-token';
  const AUTH = `Bearer ${TOKEN}`;
  const FAMILY_ID = '11111111-1111-4111-8111-111111111111';
  const USER_ID = '22222222-2222-4222-8222-222222222222';
  const family = { id: FAMILY_ID, name: 'Graph Grinders' };
  const owner = { family_id: FAMILY_ID, user_id: USER_ID };

  // The real service is replaced so these tests only check routing, auth headers,
  // validation and status codes.
  const service = {
    create: vi.fn(), findAll: vi.fn(), findOne: vi.fn(), update: vi.fn(), remove: vi.fn(),
    findOwners: vi.fn(), addOwner: vi.fn(), removeOwner: vi.fn(),
  };

  beforeAll(async () => {
    vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('SUPABASE_ANON_KEY', 'test-anon-key');
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(FamiliesService).useValue(service).compile();
    app = module.createNestApplication();
    await app.init();
  });

  beforeEach(() => { vi.resetAllMocks(); });
  afterAll(async () => {
    await app?.close();
    vi.unstubAllEnvs();
  });

  const http = () => request(app.getHttpServer());

  describe('authentication', () => {
    it.each([
      ['POST', '/families'],
      ['GET', '/families'],
      ['GET', `/families/${FAMILY_ID}`],
      ['PATCH', `/families/${FAMILY_ID}`],
      ['DELETE', `/families/${FAMILY_ID}`],
      ['GET', `/families/${FAMILY_ID}/owners`],
      ['POST', `/families/${FAMILY_ID}/owners`],
      ['DELETE', `/families/${FAMILY_ID}/owners/${USER_ID}`],
    ] as const)('%s %s returns 401 without a Bearer token', async (method, path) => {
      const req = method === 'POST' ? http().post(path)
        : method === 'PATCH' ? http().patch(path)
        : method === 'DELETE' ? http().delete(path)
        : http().get(path);
      await req.send({ name: 'A', user_id: USER_ID }).expect(401);
      for (const fn of Object.values(service)) expect(fn).not.toHaveBeenCalled();
    });

    it('rejects a header that is not a Bearer token', async () => {
      await http().get('/families').set('Authorization', `Token ${TOKEN}`).expect(401);
      expect(service.findAll).not.toHaveBeenCalled();
    });

    it('accepts a lowercase "bearer" scheme', async () => {
      service.findAll.mockResolvedValue([]);
      await http().get('/families').set('Authorization', `bearer ${TOKEN}`).expect(200);
      expect(service.findAll).toHaveBeenCalledWith(TOKEN);
    });
  });

  describe('POST /families', () => {
    it('creates a family with defaults and returns 201', async () => {
      service.create.mockResolvedValue(family);
      await http().post('/families').set('Authorization', AUTH)
        .send({ name: ' Graph Grinders ' }).expect(201, family);
      expect(service.create).toHaveBeenCalledWith(TOKEN, {
        name: 'Graph Grinders',
        required_easy: 0,
        required_medium: 0,
        required_hard: 0,
        reward_decription: '',
        punishment_decription: '',
      });
    });

    it('returns 400 for an invalid body', async () => {
      await http().post('/families').set('Authorization', AUTH).send({ required_easy: 2 }).expect(400);
      expect(service.create).not.toHaveBeenCalled();
    });

    it('passes through a 409 from the service (5-family limit)', async () => {
      service.create.mockRejectedValue(new ConflictException('You can belong to at most 5 families'));
      await http().post('/families').set('Authorization', AUTH).send({ name: 'Sixth' }).expect(409);
    });
  });

  describe('GET /families', () => {
    it('returns the user\'s families', async () => {
      service.findAll.mockResolvedValue([family]);
      await http().get('/families').set('Authorization', AUTH).expect(200, [family]);
      expect(service.findAll).toHaveBeenCalledWith(TOKEN);
    });
  });

  describe('GET /families/:familyId', () => {
    it('returns one family', async () => {
      service.findOne.mockResolvedValue(family);
      await http().get(`/families/${FAMILY_ID}`).set('Authorization', AUTH).expect(200, family);
      expect(service.findOne).toHaveBeenCalledWith(TOKEN, FAMILY_ID);
    });

    it('returns 400 for a non-UUID id', async () => {
      await http().get('/families/abc').set('Authorization', AUTH).expect(400);
      expect(service.findOne).not.toHaveBeenCalled();
    });

    it('passes through a 404 from the service', async () => {
      service.findOne.mockRejectedValue(new NotFoundException('Family not found'));
      await http().get(`/families/${FAMILY_ID}`).set('Authorization', AUTH).expect(404);
    });
  });

  describe('PATCH /families/:familyId', () => {
    it('updates the family', async () => {
      service.update.mockResolvedValue({ ...family, name: 'Renamed' });
      await http().patch(`/families/${FAMILY_ID}`).set('Authorization', AUTH)
        .send({ name: 'Renamed' }).expect(200);
      expect(service.update).toHaveBeenCalledWith(TOKEN, FAMILY_ID, { name: 'Renamed' });
    });

    it('returns 400 for an empty body', async () => {
      await http().patch(`/families/${FAMILY_ID}`).set('Authorization', AUTH).send({}).expect(400);
      expect(service.update).not.toHaveBeenCalled();
    });

    it('returns 400 for a non-UUID id', async () => {
      await http().patch('/families/abc').set('Authorization', AUTH).send({ name: 'A' }).expect(400);
    });
  });

  describe('DELETE /families/:familyId', () => {
    it('deletes the family and returns 204 with no body', async () => {
      service.remove.mockResolvedValue(undefined);
      const res = await http().delete(`/families/${FAMILY_ID}`).set('Authorization', AUTH).expect(204);
      expect(res.text).toBe('');
      expect(service.remove).toHaveBeenCalledWith(TOKEN, FAMILY_ID);
    });

    it('passes through a 403 when the user is not an owner', async () => {
      service.remove.mockRejectedValue(new ForbiddenException('Only family owners can do this'));
      await http().delete(`/families/${FAMILY_ID}`).set('Authorization', AUTH).expect(403);
    });
  });

  describe('GET /families/:familyId/owners', () => {
    it('lists the owners', async () => {
      service.findOwners.mockResolvedValue([owner]);
      await http().get(`/families/${FAMILY_ID}/owners`).set('Authorization', AUTH).expect(200, [owner]);
      expect(service.findOwners).toHaveBeenCalledWith(TOKEN, FAMILY_ID);
    });

    it('returns 400 for a non-UUID family id', async () => {
      await http().get('/families/abc/owners').set('Authorization', AUTH).expect(400);
    });
  });

  describe('POST /families/:familyId/owners', () => {
    it('adds an owner and returns 201', async () => {
      service.addOwner.mockResolvedValue(owner);
      await http().post(`/families/${FAMILY_ID}/owners`).set('Authorization', AUTH)
        .send({ user_id: USER_ID }).expect(201, owner);
      expect(service.addOwner).toHaveBeenCalledWith(TOKEN, FAMILY_ID, USER_ID);
    });

    it('returns 400 for an invalid body', async () => {
      await http().post(`/families/${FAMILY_ID}/owners`).set('Authorization', AUTH)
        .send({ user_id: 'nope' }).expect(400);
      expect(service.addOwner).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /families/:familyId/owners/:userId', () => {
    it('removes the owner and returns 204', async () => {
      service.removeOwner.mockResolvedValue(undefined);
      await http().delete(`/families/${FAMILY_ID}/owners/${USER_ID}`).set('Authorization', AUTH).expect(204);
      expect(service.removeOwner).toHaveBeenCalledWith(TOKEN, FAMILY_ID, USER_ID);
    });

    it('returns 400 for a non-UUID user id', async () => {
      await http().delete(`/families/${FAMILY_ID}/owners/abc`).set('Authorization', AUTH).expect(400);
      expect(service.removeOwner).not.toHaveBeenCalled();
    });

    it('passes through a 409 when removing the last owner', async () => {
      service.removeOwner.mockRejectedValue(new ConflictException('A family must keep at least one owner'));
      await http().delete(`/families/${FAMILY_ID}/owners/${USER_ID}`).set('Authorization', AUTH).expect(409);
    });
  });
});
