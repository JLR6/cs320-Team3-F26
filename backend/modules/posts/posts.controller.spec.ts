import 'reflect-metadata';
import { type INestApplication, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../../src/app.module';
import { PostsService } from './posts.service';

describe('Posts HTTP endpoints', () => {
  let app: INestApplication;
  const id = '11111111-1111-4111-8111-111111111111';
  const post = { post_id: id, problem_number: 1, post_description: 'A post' };
  const service = {
    findAll: vi.fn(), findOne: vi.fn(), create: vi.fn(),
    update: vi.fn(), remove: vi.fn(),
  };

  beforeAll(async () => {
    vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('SUPABASE_ANON_KEY', 'test-anon-key');
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).overrideProvider(PostsService).useValue(service).compile();
    app = module.createNestApplication();
    await app.init();
  });

  beforeEach(() => { vi.resetAllMocks(); });
  afterAll(async () => {
    await app?.close();
    vi.unstubAllEnvs();
  });

  it('GET /posts returns a list', async () => {
    service.findAll.mockResolvedValue([post]);
    await request(app.getHttpServer()).get('/posts')
      .set('Authorization', 'Bearer user-token').expect(200, [post]);
    expect(service.findAll).toHaveBeenCalledWith('user-token');
  });

  it('GET /posts/:id returns one post', async () => {
    service.findOne.mockResolvedValue(post);
    await request(app.getHttpServer()).get(`/posts/${id}`)
      .set('Authorization', 'bearer user-token').expect(200, post);
    expect(service.findOne).toHaveBeenCalledWith('user-token', id);
  });

  it('POST /posts returns the created post with status 201', async () => {
    service.create.mockResolvedValue(post);
    await request(app.getHttpServer()).post('/posts')
      .set('Authorization', 'Bearer user-token')
      .send({ problem_number: 1, post_description: 'A post' }).expect(201, post);
    expect(service.create).toHaveBeenCalledWith('user-token', { problem_number: 1, post_description: 'A post' });
  });

  it('PATCH /posts/:id returns the updated post', async () => {
    service.update.mockResolvedValue(post);
    await request(app.getHttpServer()).patch(`/posts/${id}`)
      .set('Authorization', 'Bearer user-token')
      .send({ post_description: 'A post' }).expect(200, post);
    expect(service.update).toHaveBeenCalledWith('user-token', id, { post_description: 'A post' });
  });

  it('POST requires a problem reference', async () => {
    await request(app.getHttpServer()).post('/posts')
      .set('Authorization', 'Bearer user-token')
      .send({ post_description: 'Missing problem' }).expect(400);
    expect(service.create).not.toHaveBeenCalled();
  });

  it('POST accepts a problem without optional text fields', async () => {
    service.create.mockResolvedValue(post);
    await request(app.getHttpServer()).post('/posts')
      .set('Authorization', 'Bearer user-token').send({ problem_number: 1 }).expect(201);
    expect(service.create).toHaveBeenCalledWith('user-token', { problem_number: 1 });
  });

  it('PATCH can clear nullable fields and preserves solution formatting', async () => {
    service.update.mockResolvedValue(post);
    const body = {
      post_description: null, user_solution: '  return answer;\n', user_time_complexity: 'O(n)',
    };
    await request(app.getHttpServer()).patch(`/posts/${id}`)
      .set('Authorization', 'Bearer user-token').send(body).expect(200);
    expect(service.update).toHaveBeenCalledWith('user-token', id, body);
  });

  it.each(['user_solution', 'user_time_complexity'])('rejects non-text %s', async field => {
    await request(app.getHttpServer()).patch(`/posts/${id}`)
      .set('Authorization', 'Bearer user-token').send({ [field]: 42 }).expect(400);
  });

  it('DELETE /posts/:id returns 204 with no body', async () => {
    service.remove.mockResolvedValue(undefined);
    const response = await request(app.getHttpServer()).delete(`/posts/${id}`)
      .set('Authorization', 'Bearer user-token').expect(204);
    expect(response.text).toBe('');
    expect(service.remove).toHaveBeenCalledWith('user-token', id);
  });

  const routes = [
    ['get', '/posts'], ['get', `/posts/${id}`], ['post', '/posts'],
    ['patch', `/posts/${id}`], ['delete', `/posts/${id}`],
  ] as const;

  it.each(routes)('%s %s rejects missing authentication', async (method, path) => {
    await request(app.getHttpServer())[method](path).send({ post_description: 'A post' }).expect(401);
    for (const mock of Object.values(service)) expect(mock).not.toHaveBeenCalled();
  });

  it.each(['Basic abc', 'Bearer', 'Bearer a b'])('rejects malformed authentication: %s', async header => {
    await request(app.getHttpServer()).get('/posts')
      .set('Authorization', header).expect(401);
  });

  describe.each(['post', 'patch'] as const)('%s content validation', method => {
    it.each([
      {}, { problem_number: null }, { problem_number: 1.5 }, { problem_number: '1' },
      { problem_number: 2147483648 }, { post_description: 42 },
      { problem_number: 1, user_id: id }, { problem_number: 1, like_count: 2 },
      { content: 'Old field' }, [],
    ].map(body => ({ body })))('rejects invalid or extra fields: %j', async ({ body }) => {
      const path = method === 'post' ? '/posts' : `/posts/${id}`;
      await request(app.getHttpServer())[method](path)
        .set('Authorization', 'Bearer user-token').send(body).expect(400);
      expect(service.create).not.toHaveBeenCalled();
      expect(service.update).not.toHaveBeenCalled();
    });
  });

  it.each(['get', 'patch', 'delete'] as const)('%s rejects invalid post IDs', async method => {
    await request(app.getHttpServer())[method]('/posts/not-a-uuid')
      .set('Authorization', 'Bearer user-token').send({ post_description: 'A post' }).expect(400);
  });

  it('preserves a service 404 response', async () => {
    service.findOne.mockRejectedValue(new NotFoundException('Post not found'));
    await request(app.getHttpServer()).get(`/posts/${id}`)
      .set('Authorization', 'Bearer user-token').expect(404);
  });
});
