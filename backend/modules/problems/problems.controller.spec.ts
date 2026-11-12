import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../../src/app.module';
import { ProblemsService } from './problems.service';

describe('Problems HTTP endpoints', () => {
  let app: INestApplication;
  const ADMIN = 'test-admin-key';
  const twoSum = {
    problem_number: 1,
    problem_link: 'https://leetcode.com/problems/two-sum/',
    problem_title: 'Two Sum',
    problem_difficulty: 'Easy',
  };
  const service = {
    findAll: vi.fn(), findOne: vi.fn(), create: vi.fn(),
    update: vi.fn(), remove: vi.fn(), findOrCreate: vi.fn(),
  };

  beforeAll(async () => {
    vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('SUPABASE_ANON_KEY', 'test-anon-key');
    vi.stubEnv('ADMIN_API_KEY', ADMIN);
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ProblemsService).useValue(service).compile();
    app = module.createNestApplication();
    await app.init();
  });

  beforeEach(() => { vi.resetAllMocks(); });
  afterAll(async () => {
    await app?.close();
    vi.unstubAllEnvs();
  });

  const http = () => request(app.getHttpServer());

  it('GET /problems is public and passes filters', async () => {
    service.findAll.mockResolvedValue([twoSum]);
    await http().get('/problems?difficulty=Easy&tag=Array').expect(200, [twoSum]);
    expect(service.findAll).toHaveBeenCalledWith({ difficulty: 'Easy', tag: 'Array' });
  });

  it('GET /problems rejects a bad difficulty', async () => {
    await http().get('/problems?difficulty=Impossible').expect(400);
    expect(service.findAll).not.toHaveBeenCalled();
  });

  it('GET /problems/:n returns one problem', async () => {
    service.findOne.mockResolvedValue(twoSum);
    await http().get('/problems/1').expect(200, twoSum);
    expect(service.findOne).toHaveBeenCalledWith(1);
  });

  it('GET /problems/:n returns 404 from the service', async () => {
    service.findOne.mockRejectedValue(new NotFoundException('Problem not found'));
    await http().get('/problems/99').expect(404);
  });

  it('GET /problems/:n rejects a non-number', async () => {
    await http().get('/problems/abc').expect(400);
  });

  it('POST /problems creates with the admin key', async () => {
    service.create.mockResolvedValue(twoSum);
    await http().post('/problems').set('x-admin-key', ADMIN).send(twoSum).expect(201, twoSum);
    expect(service.create).toHaveBeenCalledWith(twoSum);
  });

  it('POST /problems is forbidden without the admin key', async () => {
    await http().post('/problems').send(twoSum).expect(403);
    await http().post('/problems').set('x-admin-key', 'wrong-key-same-len').send(twoSum).expect(403);
    await http().post('/problems').set('x-admin-key', 'short').send(twoSum).expect(403);
    expect(service.create).not.toHaveBeenCalled();
  });

  it('POST /problems validates the body', async () => {
    await http().post('/problems').set('x-admin-key', ADMIN)
      .send({ ...twoSum, problem_title: '' }).expect(400);
  });

  it('PATCH /problems/:n updates with the admin key', async () => {
    service.update.mockResolvedValue({ ...twoSum, problem_difficulty: 'Medium' });
    await http().patch('/problems/1').set('x-admin-key', ADMIN)
      .send({ problem_difficulty: 'Medium' }).expect(200);
    expect(service.update).toHaveBeenCalledWith(1, { problem_difficulty: 'Medium' });
  });

  it('PATCH /problems/:n cannot change problem_number', async () => {
    await http().patch('/problems/1').set('x-admin-key', ADMIN)
      .send({ problem_number: 2 }).expect(400);
  });

  it('PATCH /problems/:n is forbidden without the admin key', async () => {
    await http().patch('/problems/1').send({ problem_title: 'x' }).expect(403);
  });

  it('DELETE /problems/:n returns 204 with the admin key', async () => {
    service.remove.mockResolvedValue(undefined);
    await http().delete('/problems/1').set('x-admin-key', ADMIN).expect(204);
    expect(service.remove).toHaveBeenCalledWith(1);
  });

  it('DELETE /problems/:n is forbidden without the admin key', async () => {
    await http().delete('/problems/1').expect(403);
    expect(service.remove).not.toHaveBeenCalled();
  });

  it('writes are forbidden when ADMIN_API_KEY is not configured', async () => {
    vi.stubEnv('ADMIN_API_KEY', '');
    await http().delete('/problems/1').set('x-admin-key', ADMIN).expect(403);
    vi.stubEnv('ADMIN_API_KEY', ADMIN);
  });
});
