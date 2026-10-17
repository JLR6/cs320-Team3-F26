import 'reflect-metadata';
import { type INestApplication, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../../src/app.module';
import { CommentsService } from './comments.service';

describe('Comments HTTP endpoints', () => {
  let app: INestApplication;
  const postId = '11111111-1111-4111-8111-111111111111';
  const commentId = '22222222-2222-4222-8222-222222222222';
  const token = 'Bearer user-token';
  const comment = {
    comment_id: commentId,
    post_id: postId,
    comment_text: 'W solution',
  };
  const service = {
    create: vi.fn(),
    findForPost: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };

  beforeAll(async () => {
    vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('SUPABASE_ANON_KEY', 'test-anon-key');
    const module = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(CommentsService)
      .useValue(service)
      .compile();
    app = module.createNestApplication();
    await app.init();
  });
  beforeEach(() => {
    vi.resetAllMocks();
  });
  afterAll(async () => {
    await app?.close();
    vi.unstubAllEnvs();
  });

  it('GET /comments returns comments for a post', async () => {
    service.findForPost.mockResolvedValue([comment]);
    await request(app.getHttpServer())
      .get(`/comments?post_id=${postId}`)
      .expect(200, [comment]);
    expect(service.findForPost).toHaveBeenCalledWith(postId);
  });

  it('GET /comments rejects an invalid post ID', async () => {
    await request(app.getHttpServer())
      .get('/comments?post_id=bad-id')
      .expect(400);
    expect(service.findForPost).not.toHaveBeenCalled();
  });

  it('GET /comments/:id returns one comment', async () => {
    service.findOne.mockResolvedValue(comment);
    await request(app.getHttpServer())
      .get(`/comments/${commentId}`)
      .expect(200, comment);
    expect(service.findOne).toHaveBeenCalledWith(commentId);
  });

  it('GET /comments/:id returns 404 if missing', async () => {
    service.findOne.mockRejectedValue(
      new NotFoundException('Comment not found'),
    );
    await request(app.getHttpServer())
      .get(`/comments/${commentId}`)
      .expect(404);
  });

  it('GET /comments/:id rejects an invalid ID', async () => {
    await request(app.getHttpServer())
      .get('/comments/bad-id')
      .expect(400);
    expect(service.findOne).not.toHaveBeenCalled();
  });

  it('POST /comments creates a comment', async () => {
    const body = {
      post_id: postId,
      comment_text: 'W solution',
    };
    service.create.mockResolvedValue(comment);
    await request(app.getHttpServer())
      .post('/comments')
      .set('Authorization', token)
      .send(body)
      .expect(201, comment);
    expect(service.create).toHaveBeenCalledWith(token, body);
  });

  it('PATCH /comments/:id updates a comment', async () => {
    const body = { comment_text: 'Updated comment' };
    const updatedComment = { ...comment, ...body };
    service.update.mockResolvedValue(updatedComment);
    await request(app.getHttpServer())
      .patch(`/comments/${commentId}`)
      .set('Authorization', token)
      .send(body)
      .expect(200, updatedComment);
    expect(service.update).toHaveBeenCalledWith(
      commentId,
      token,
      body,
    );
  });

  it('DELETE /comments/:id returns 204 with no body', async () => {
    service.remove.mockResolvedValue(undefined);
    const response = await request(app.getHttpServer())
      .delete(`/comments/${commentId}`)
      .set('Authorization', token)
      .expect(204);
    expect(response.text).toBe('');
    expect(service.remove).toHaveBeenCalledWith(commentId, token);
  });

  it('DELETE /comments/:id rejects an invalid ID', async () => {
    await request(app.getHttpServer())
      .delete('/comments/bad-id')
      .set('Authorization', token)
      .expect(400);
    expect(service.remove).not.toHaveBeenCalled();
  });
});
