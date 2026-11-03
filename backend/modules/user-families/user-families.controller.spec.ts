import 'reflect-metadata';
import { type INestApplication, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../../src/app.module';
import { UserFamiliesService } from './user-families.service';

describe('User families HTTP endpoints', () => {
  let app: INestApplication;
  const familyId = '11111111-1111-4111-8111-111111111111';
  const membership = {
    user_id: '22222222-2222-4222-8222-222222222222',
    family_id: familyId,
    completed_easy: 0,
    completed_medium: 0,
    completed_hard: 0,
  };
  const service = {
    findAll: vi.fn(), findOne: vi.fn(), create: vi.fn(),
    update: vi.fn(), remove: vi.fn(),
  };

  beforeAll(async () => {
    vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('SUPABASE_ANON_KEY', 'test-anon-key');
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(UserFamiliesService).useValue(service).compile();
    app = module.createNestApplication();
    await app.init();
  });

  beforeEach(() => { vi.resetAllMocks(); });
  afterAll(async () => {
    await app?.close();
    vi.unstubAllEnvs();
  });

  it('GET /user-families returns the signed-in user memberships', async () => {
    service.findAll.mockResolvedValue([membership]);
    await request(app.getHttpServer()).get('/user-families')
      .set('Authorization', 'Bearer user-token').expect(200, [membership]);
    expect(service.findAll).toHaveBeenCalledWith('user-token');
  });

  it('GET /user-families/:familyId returns one membership', async () => {
    service.findOne.mockResolvedValue(membership);
    await request(app.getHttpServer()).get(`/user-families/${familyId}`)
      .set('Authorization', 'bearer user-token').expect(200, membership);
    expect(service.findOne).toHaveBeenCalledWith('user-token', familyId);
  });

  it('POST /user-families accepts a family without optional counts', async () => {
    service.create.mockResolvedValue(membership);
    await request(app.getHttpServer()).post('/user-families')
      .set('Authorization', 'Bearer user-token')
      .send({ family_id: familyId }).expect(201, membership);
    expect(service.create).toHaveBeenCalledWith('user-token', { family_id: familyId });
  });

  it('POST /user-families accepts completion counts', async () => {
    const body = { family_id: familyId, completed_easy: 2, completed_medium: 1, completed_hard: 0 };
    service.create.mockResolvedValue({ ...membership, ...body });
    await request(app.getHttpServer()).post('/user-families')
      .set('Authorization', 'Bearer user-token').send(body).expect(201, { ...membership, ...body });
    expect(service.create).toHaveBeenCalledWith('user-token', body);
  });

  it('PATCH /user-families/:familyId accepts a subset of counts, including zero', async () => {
    const body = { completed_easy: 0, completed_hard: 3 };
    service.update.mockResolvedValue({ ...membership, ...body });
    await request(app.getHttpServer()).patch(`/user-families/${familyId}`)
      .set('Authorization', 'Bearer user-token').send(body).expect(200, { ...membership, ...body });
    expect(service.update).toHaveBeenCalledWith('user-token', familyId, body);
  });

  it('DELETE /user-families/:familyId returns 204 with no body', async () => {
    service.remove.mockResolvedValue(undefined);
    const response = await request(app.getHttpServer()).delete(`/user-families/${familyId}`)
      .set('Authorization', 'Bearer user-token').expect(204);
    expect(response.text).toBe('');
    expect(service.remove).toHaveBeenCalledWith('user-token', familyId);
  });

  const routes = [
    ['get', '/user-families'], ['get', `/user-families/${familyId}`],
    ['post', '/user-families'], ['patch', `/user-families/${familyId}`],
    ['delete', `/user-families/${familyId}`],
  ] as const;

  it.each(routes)('%s %s requires authentication', async (method, path) => {
    await request(app.getHttpServer())[method](path).expect(401);
    for (const mock of Object.values(service)) expect(mock).not.toHaveBeenCalled();
  });

  it.each(['Basic abc', 'Bearer', 'Bearer a b'])('rejects malformed authentication: %s', async header => {
    await request(app.getHttpServer()).get('/user-families')
      .set('Authorization', header).expect(401);
    expect(service.findAll).not.toHaveBeenCalled();
  });

  it.each(['get', 'patch', 'delete'] as const)('%s rejects invalid family IDs', async method => {
    await request(app.getHttpServer())[method]('/user-families/not-a-uuid')
      .set('Authorization', 'Bearer user-token').send({ completed_easy: 1 }).expect(400);
    for (const mock of Object.values(service)) expect(mock).not.toHaveBeenCalled();
  });

  it.each([
    {}, { family_id: 'bad-id' }, { family_id: null }, { family_id: 1 }, [],
    { family_id: familyId, user_id: familyId },
    { family_id: familyId, completed_easy: -1 },
    { family_id: familyId, completed_medium: 1.5 },
    { family_id: familyId, completed_hard: 2147483648 },
    { family_id: familyId, completed_easy: '1' },
    { family_id: familyId, completed_medium: null },
    { family_id: familyId, created_at: '2026-10-28T00:00:00Z' },
  ].map(body => ({ body })))('POST rejects invalid fields: $body', async ({ body }) => {
    await request(app.getHttpServer()).post('/user-families')
      .set('Authorization', 'Bearer user-token').send(body).expect(400);
    expect(service.create).not.toHaveBeenCalled();
  });

  it.each([
    {}, [], { family_id: familyId }, { user_id: familyId }, { completed_easy: -1 },
    { completed_medium: 1.5 }, { completed_hard: 2147483648 },
    { completed_easy: '1' }, { completed_hard: null },
    { updated_at: '2026-10-28T00:00:00Z' },
  ].map(body => ({ body })))('PATCH rejects invalid fields: $body', async ({ body }) => {
    await request(app.getHttpServer()).patch(`/user-families/${familyId}`)
      .set('Authorization', 'Bearer user-token').send(body).expect(400);
    expect(service.update).not.toHaveBeenCalled();
  });

  it('preserves a service 404 response', async () => {
    service.findOne.mockRejectedValue(new NotFoundException('User family not found'));
    await request(app.getHttpServer()).get(`/user-families/${familyId}`)
      .set('Authorization', 'Bearer user-token').expect(404);
  });
});
