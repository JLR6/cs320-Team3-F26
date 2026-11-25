import 'reflect-metadata';
import {
  type INestApplication,
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../../src/app.module';
import { FollowsService } from './follows.service';
import { UsersService } from '../users/users.service';

describe('Follows HTTP endpoints', () => {
  let app: INestApplication;
  const userId = '22222222-2222-4222-8222-222222222222';
  const token = 'Bearer user-token';
  const service = {
    findFollowing: vi.fn(),
    follow: vi.fn(),
    unfollow: vi.fn(),
  };
  // the users module also lives under /users, so make sure it never answers these routes
  const usersService = { getUserById: vi.fn() };

  beforeAll(async () => {
    vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('SUPABASE_ANON_KEY', 'test-anon-key');
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(FollowsService)
      .useValue(service)
      .overrideProvider(UsersService)
      .useValue(usersService)
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

  const http = () => request(app.getHttpServer());

  it('GET /users/:id/following returns the list', async () => {
    const list = [
      { user_id: userId, username: 'Elizabeth S.', profile_picture: null, last_posted_at: null },
    ];
    service.findFollowing.mockResolvedValueOnce(list);

    await http().get(`/users/${userId}/following`).set('Authorization', token).expect(200, list);
    expect(service.findFollowing).toHaveBeenCalledWith(userId, token);
    expect(usersService.getUserById).not.toHaveBeenCalled();
  });

  it('POST /users/:id/follow follows the user', async () => {
    const row = { follower_id: 'me', following_id: userId };
    service.follow.mockResolvedValueOnce(row);

    await http().post(`/users/${userId}/follow`).set('Authorization', token).expect(201, row);
    expect(service.follow).toHaveBeenCalledWith(userId, token);
  });

  it('DELETE /users/:id/follow unfollows with no body', async () => {
    service.unfollow.mockResolvedValueOnce(undefined);

    const res = await http()
      .delete(`/users/${userId}/follow`)
      .set('Authorization', token)
      .expect(204);
    expect(res.text).toBe('');
    expect(service.unfollow).toHaveBeenCalledWith(userId, token);
  });

  // the service's errors pass straight through as HTTP status codes
  it.each([
    ['follow yourself', new BadRequestException("You can't follow yourself"), 400],
    ['missing login', new UnauthorizedException('You must be logged in'), 401],
    ['unknown user', new NotFoundException('User not found'), 404],
    ['already following', new ConflictException('You already follow this user'), 409],
  ])('POST /users/:id/follow returns the right status for %s', async (_case, error, status) => {
    service.follow.mockRejectedValueOnce(error);
    await http().post(`/users/${userId}/follow`).set('Authorization', token).expect(status);
  });

  it("DELETE /users/:id/follow returns 404 when you don't follow them", async () => {
    service.unfollow.mockRejectedValueOnce(new NotFoundException("You don't follow this user"));
    await http().delete(`/users/${userId}/follow`).set('Authorization', token).expect(404);
  });

  it.each([
    ['get', '/users/not-a-uuid/following'],
    ['post', '/users/not-a-uuid/follow'],
    ['delete', '/users/not-a-uuid/follow'],
  ] as const)('%s %s rejects an id that is not a UUID', async (method, path) => {
    await http()[method](path).set('Authorization', token).expect(400);
    expect(service.findFollowing).not.toHaveBeenCalled();
    expect(service.follow).not.toHaveBeenCalled();
    expect(service.unfollow).not.toHaveBeenCalled();
  });
});
