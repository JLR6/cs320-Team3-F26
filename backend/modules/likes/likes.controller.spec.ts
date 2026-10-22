import 'reflect-metadata';
import { type INestApplication, ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../../src/app.module';
import { LikesService } from './likes.service';

describe('Likes HTTP endpoints', () => {
  let app: INestApplication;
  const postId = '11111111-1111-4111-8111-111111111111';
  const commentId = '22222222-2222-4222-8222-222222222222';
  const userId = '33333333-3333-4333-8333-333333333333';
  const token = 'Bearer user-token';
  const service = {
    like: vi.fn(),
    unlike: vi.fn(),
    findLikes: vi.fn(),
    hasLiked: vi.fn(),
  };

  beforeAll(async () => {
    vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('SUPABASE_ANON_KEY', 'test-anon-key');
    const module = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(LikesService)
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

  describe.each([
    ['post', 'posts', postId],
    ['comment', 'comments', commentId],
  ] as const)('%s likes', (target, path, id) => {
    it(`POST /${path}/:id/likes likes it`, async () => {
      const row = { [`${target}_id`]: id, user_id: userId };
      service.like.mockResolvedValueOnce(row);

      const res = await request(app.getHttpServer())
        .post(`/${path}/${id}/likes`)
        .set('Authorization', token)
        .expect(201);

      expect(res.body).toEqual(row);
      expect(service.like).toHaveBeenCalledWith(target, id, token);
    });

    it(`POST /${path}/:id/likes returns 409 when already liked`, async () => {
      service.like.mockRejectedValueOnce(new ConflictException('already liked'));
      await request(app.getHttpServer())
        .post(`/${path}/${id}/likes`)
        .set('Authorization', token)
        .expect(409);
    });

    it(`DELETE /${path}/:id/likes unlikes it`, async () => {
      service.unlike.mockResolvedValueOnce(undefined);
      await request(app.getHttpServer())
        .delete(`/${path}/${id}/likes`)
        .set('Authorization', token)
        .expect(204);
      expect(service.unlike).toHaveBeenCalledWith(target, id, token);
    });

    it(`DELETE /${path}/:id/likes returns 404 when not liked`, async () => {
      service.unlike.mockRejectedValueOnce(new NotFoundException('like not found'));
      await request(app.getHttpServer())
        .delete(`/${path}/${id}/likes`)
        .set('Authorization', token)
        .expect(404);
    });

    it(`GET /${path}/:id/likes returns the summary`, async () => {
      const summary = { like_count: 1, user_ids: [userId] };
      service.findLikes.mockResolvedValueOnce(summary);
      const res = await request(app.getHttpServer()).get(`/${path}/${id}/likes`).expect(200);
      expect(res.body).toEqual(summary);
      expect(service.findLikes).toHaveBeenCalledWith(target, id);
    });

    it(`GET /${path}/:id/likes/me says if the user liked it`, async () => {
      service.hasLiked.mockResolvedValueOnce({ liked: true });
      const res = await request(app.getHttpServer())
        .get(`/${path}/${id}/likes/me`)
        .set('Authorization', token)
        .expect(200);
      expect(res.body).toEqual({ liked: true });
      expect(service.hasLiked).toHaveBeenCalledWith(target, id, token);
    });

    it(`rejects a non-UUID ${target} id`, async () => {
      await request(app.getHttpServer()).post(`/${path}/not-a-uuid/likes`).expect(400);
      expect(service.like).not.toHaveBeenCalled();
    });
  });
});
