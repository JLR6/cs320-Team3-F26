/**
 * HTTP tests for the /families routes.
 *
 * The real FamiliesService is replaced with a fake (vi.fn() for each method), so these
 * tests only check the controller's job: routing, reading the Bearer token, validating
 * the URL and body, and returning the right status codes. Database behavior is covered in
 * families.service.spec.ts. Requests are sent with Supertest against the real Nest app.
 */
import 'reflect-metadata';
import {
  BadRequestException,
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
  const admin = { family_id: FAMILY_ID, user_id: USER_ID };

  const service = {
    create: vi.fn(), findAll: vi.fn(), findOne: vi.fn(), update: vi.fn(), remove: vi.fn(),
    findOwner: vi.fn(), transferOwnership: vi.fn(),
    findAdmins: vi.fn(), addAdmin: vi.fn(), removeAdmin: vi.fn(),
    removeMember: vi.fn(),
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

  // Every route must refuse requests without a valid "Bearer <token>" header, before the
  // service is ever called.
  describe('authentication', () => {
    it.each([
      ['POST', '/families'],
      ['GET', '/families'],
      ['GET', `/families/${FAMILY_ID}`],
      ['PATCH', `/families/${FAMILY_ID}`],
      ['DELETE', `/families/${FAMILY_ID}`],
      ['GET', `/families/${FAMILY_ID}/owner`],
      ['PUT', `/families/${FAMILY_ID}/owner`],
      ['GET', `/families/${FAMILY_ID}/admins`],
      ['POST', `/families/${FAMILY_ID}/admins`],
      ['DELETE', `/families/${FAMILY_ID}/admins/${USER_ID}`],
      ['DELETE', `/families/${FAMILY_ID}/members/${USER_ID}`],
    ] as const)('%s %s returns 401 without a Bearer token', async (method, path) => {
      const req = method === 'POST' ? http().post(path)
        : method === 'PATCH' ? http().patch(path)
        : method === 'PUT' ? http().put(path)
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

  // Ids in the URL must be UUIDs; anything else is rejected with 400 before the service runs.
  describe('URL validation', () => {
    it.each([
      ['GET', '/families/abc'],
      ['PATCH', '/families/abc'],
      ['DELETE', '/families/abc'],
      ['GET', '/families/abc/owner'],
      ['PUT', '/families/abc/owner'],
      ['GET', '/families/abc/admins'],
      ['POST', '/families/abc/admins'],
      ['DELETE', `/families/${FAMILY_ID}/admins/abc`],
      ['DELETE', `/families/${FAMILY_ID}/members/abc`],
    ] as const)('%s %s returns 400 for a non-UUID id', async (method, path) => {
      const req = method === 'POST' ? http().post(path)
        : method === 'PATCH' ? http().patch(path)
        : method === 'PUT' ? http().put(path)
        : method === 'DELETE' ? http().delete(path)
        : http().get(path);
      await req.set('Authorization', AUTH).send({ name: 'A', user_id: USER_ID }).expect(400);
      for (const fn of Object.values(service)) expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('families', () => {
    it('POST /families creates a family with defaults and returns 201', async () => {
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

    it('POST /families returns 400 for an invalid body', async () => {
      await http().post('/families').set('Authorization', AUTH).send({ required_easy: 2 }).expect(400);
      expect(service.create).not.toHaveBeenCalled();
    });

    it('POST /families passes through a 409 (5-family limit)', async () => {
      service.create.mockRejectedValue(new ConflictException('You can belong to at most 5 families'));
      await http().post('/families').set('Authorization', AUTH).send({ name: 'Sixth' }).expect(409);
    });

    it('GET /families lists the user\'s families', async () => {
      service.findAll.mockResolvedValue([family]);
      await http().get('/families').set('Authorization', AUTH).expect(200, [family]);
      expect(service.findAll).toHaveBeenCalledWith(TOKEN);
    });

    it('GET /families/:familyId returns one family', async () => {
      service.findOne.mockResolvedValue(family);
      await http().get(`/families/${FAMILY_ID}`).set('Authorization', AUTH).expect(200, family);
      expect(service.findOne).toHaveBeenCalledWith(TOKEN, FAMILY_ID);
    });

    it('GET /families/:familyId passes through a 404', async () => {
      service.findOne.mockRejectedValue(new NotFoundException('Family not found'));
      await http().get(`/families/${FAMILY_ID}`).set('Authorization', AUTH).expect(404);
    });

    it('PATCH /families/:familyId updates the family', async () => {
      service.update.mockResolvedValue({ ...family, name: 'Renamed' });
      await http().patch(`/families/${FAMILY_ID}`).set('Authorization', AUTH)
        .send({ name: 'Renamed' }).expect(200);
      expect(service.update).toHaveBeenCalledWith(TOKEN, FAMILY_ID, { name: 'Renamed' });
    });

    it('PATCH /families/:familyId returns 400 for an empty body', async () => {
      await http().patch(`/families/${FAMILY_ID}`).set('Authorization', AUTH).send({}).expect(400);
      expect(service.update).not.toHaveBeenCalled();
    });

    it('DELETE /families/:familyId returns 204 with no body', async () => {
      service.remove.mockResolvedValue(undefined);
      const res = await http().delete(`/families/${FAMILY_ID}`).set('Authorization', AUTH).expect(204);
      expect(res.text).toBe('');
      expect(service.remove).toHaveBeenCalledWith(TOKEN, FAMILY_ID);
    });

    it('DELETE /families/:familyId passes through a 403 for non-owners', async () => {
      service.remove.mockRejectedValue(new ForbiddenException('Your role in this family does not allow this'));
      await http().delete(`/families/${FAMILY_ID}`).set('Authorization', AUTH).expect(403);
    });
  });

  describe('owner', () => {
    it('GET /families/:familyId/owner returns the owner', async () => {
      service.findOwner.mockResolvedValue(owner);
      await http().get(`/families/${FAMILY_ID}/owner`).set('Authorization', AUTH).expect(200, owner);
      expect(service.findOwner).toHaveBeenCalledWith(TOKEN, FAMILY_ID);
    });

    it('PUT /families/:familyId/owner transfers ownership and returns 200', async () => {
      service.transferOwnership.mockResolvedValue(owner);
      await http().put(`/families/${FAMILY_ID}/owner`).set('Authorization', AUTH)
        .send({ user_id: USER_ID }).expect(200, owner);
      expect(service.transferOwnership).toHaveBeenCalledWith(TOKEN, FAMILY_ID, USER_ID);
    });

    it('PUT /families/:familyId/owner returns 400 for an invalid body', async () => {
      await http().put(`/families/${FAMILY_ID}/owner`).set('Authorization', AUTH)
        .send({ user_id: 'nope' }).expect(400);
      expect(service.transferOwnership).not.toHaveBeenCalled();
    });

    it('PUT /families/:familyId/owner passes through a 404 when the new owner is not a member', async () => {
      service.transferOwnership.mockRejectedValue(new NotFoundException('That user is not a member of this family'));
      await http().put(`/families/${FAMILY_ID}/owner`).set('Authorization', AUTH)
        .send({ user_id: USER_ID }).expect(404);
    });
  });

  describe('admins', () => {
    it('GET /families/:familyId/admins lists admins', async () => {
      service.findAdmins.mockResolvedValue([admin]);
      await http().get(`/families/${FAMILY_ID}/admins`).set('Authorization', AUTH).expect(200, [admin]);
      expect(service.findAdmins).toHaveBeenCalledWith(TOKEN, FAMILY_ID);
    });

    it('POST /families/:familyId/admins adds an admin and returns 201', async () => {
      service.addAdmin.mockResolvedValue(admin);
      await http().post(`/families/${FAMILY_ID}/admins`).set('Authorization', AUTH)
        .send({ user_id: USER_ID }).expect(201, admin);
      expect(service.addAdmin).toHaveBeenCalledWith(TOKEN, FAMILY_ID, USER_ID);
    });

    it('POST /families/:familyId/admins returns 400 for an invalid body', async () => {
      await http().post(`/families/${FAMILY_ID}/admins`).set('Authorization', AUTH)
        .send({ user_id: USER_ID, role: 'owner' }).expect(400);
      expect(service.addAdmin).not.toHaveBeenCalled();
    });

    it('POST /families/:familyId/admins passes through a 409 for an existing admin', async () => {
      service.addAdmin.mockRejectedValue(new ConflictException('That user is already an admin of this family'));
      await http().post(`/families/${FAMILY_ID}/admins`).set('Authorization', AUTH)
        .send({ user_id: USER_ID }).expect(409);
    });

    it('DELETE /families/:familyId/admins/:userId returns 204', async () => {
      service.removeAdmin.mockResolvedValue(undefined);
      await http().delete(`/families/${FAMILY_ID}/admins/${USER_ID}`).set('Authorization', AUTH).expect(204);
      expect(service.removeAdmin).toHaveBeenCalledWith(TOKEN, FAMILY_ID, USER_ID);
    });
  });

  describe('members', () => {
    it('DELETE /families/:familyId/members/:userId returns 204', async () => {
      service.removeMember.mockResolvedValue(undefined);
      await http().delete(`/families/${FAMILY_ID}/members/${USER_ID}`).set('Authorization', AUTH).expect(204);
      expect(service.removeMember).toHaveBeenCalledWith(TOKEN, FAMILY_ID, USER_ID);
    });

    it('DELETE /families/:familyId/members/:userId passes through a 400 when removing the owner', async () => {
      service.removeMember.mockRejectedValue(new BadRequestException("This action isn't allowed on the family owner"));
      await http().delete(`/families/${FAMILY_ID}/members/${USER_ID}`).set('Authorization', AUTH).expect(400);
    });
  });
});
