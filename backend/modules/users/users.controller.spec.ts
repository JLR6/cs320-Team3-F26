import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, NotFoundException, BadRequestException } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';

describe('User Endpoints', () => {
  let app: INestApplication;
  const id = '11111111-1111-1111-1111-111111111111';
  const service = {
    getUserById: vi.fn(), getUserByUsername: vi.fn(), createUser: vi.fn(), updateUser: vi.fn(), deleteUser: vi.fn(),
    uploadProfilePicture: vi.fn(), getProfilePicture: vi.fn()
  }
  const user = { id: '1', username: 'testuser', email: 'test@gmail.com', profile_picture: '/1/test.jpg' }

  beforeAll(async () => {
    vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('SUPABASE_ANON_KEY', 'test-anon-key');
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [UsersService],
    }).overrideProvider(UsersService).useValue(service).compile();

    app = module.createNestApplication();
    await app.init();
  });

  beforeEach(async () => {
    vi.resetAllMocks();
  });

  afterAll(async () => {
    await app?.close();
    vi.unstubAllEnvs();
  });

  //                                //
  // <---> Get endpoint tests <---> //
  //                                //

  it('GET /users/:id returns the user', async () => {
    service.getUserById.mockResolvedValue(user);
    const response = await request(app.getHttpServer()).get(`/users/${id}`).set('Authorization', 'Bearer test-token');
    expect(response.status).toBe(200);
    expect(service.getUserById).toHaveBeenCalledWith('test-token', id);
  });

  it('GET /users/:username returns the user', async () => {
    service.getUserByUsername.mockResolvedValue(user);
    const response = await request(app.getHttpServer()).get('/users/username/testuser').set('Authorization', 'Bearer test-token');
    expect(response.status).toBe(200);
    expect(service.getUserByUsername).toHaveBeenCalledWith('test-token', 'testuser');
  });

  it('GET /users/:id returns 404 if user not found', async () => {
    service.getUserById.mockRejectedValue(new NotFoundException('User not found'));
    const response = await request(app.getHttpServer()).get(`/users/${id}`).set('Authorization', 'Bearer test-token');
    expect(response.status).toBe(404);
    expect(service.getUserById).toHaveBeenCalledWith('test-token', id);
  });

  it('GET /users/:username returns 404 if user not found', async () => {
    service.getUserByUsername.mockRejectedValue(new NotFoundException('User not found'));
    const response = await request(app.getHttpServer()).get('/users/username/nonexistentuser').set('Authorization', 'Bearer test-token');
    expect(response.status).toBe(404);
    expect(service.getUserByUsername).toHaveBeenCalledWith('test-token', 'nonexistentuser');
  });

  //                                   //
  // <---> Create endpoint tests <---> //
  //                                   //

  it('POST /users creates and returns a new user', async () => {

    service.createUser.mockResolvedValue(user);
    const response = await request(app.getHttpServer()).post('/users').set('Authorization', 'Bearer test-token').send({ username: 'testuser', email: 'test@gmail.com' });
    expect(response.status).toBe(201);
    expect(service.createUser).toHaveBeenCalledWith('test-token', { username: 'testuser', email: 'test@gmail.com' });
    
  });

  it('POST /users returns 400 if required fields are missing', async () => {
    service.createUser.mockRejectedValue(new BadRequestException('Required fields are missing'));
    const response = await request(app.getHttpServer()).post('/users').set('Authorization', 'Bearer test-token').send({});
    expect(response.status).toBe(400);
  });

  //                                   //
  // <---> Update endpoint tests <---> //
  //                                   //

  it('PATCH /users/:id updates the user', async () => {
    service.updateUser.mockResolvedValue(user);
    const response = await request(app.getHttpServer()).patch(`/users/${id}`).set('Authorization', 'Bearer test-token').send({ username: 'updateduser' });
    expect(response.status).toBe(200);
    expect(service.updateUser).toHaveBeenCalledWith('test-token', id, { username: 'updateduser' });
  });

  it('PATCH /users/:id returns 404 if user not found', async () => {
    service.updateUser.mockRejectedValue(new NotFoundException('User not found'));
    const response = await request(app.getHttpServer()).patch(`/users/${id}`).set('Authorization', 'Bearer test-token').send({ username: 'updateduser' });
    expect(response.status).toBe(404);
    expect(service.updateUser).toHaveBeenCalledWith('test-token', id, { username: 'updateduser' });
  });

  //                                   //
  // <---> Delete endpoint tests <---> //
  //                                   //

  it('DELETE /users/:id deletes the user', async () => {
    service.deleteUser.mockResolvedValue(null);
    const response = await request(app.getHttpServer()).delete(`/users/${id}`).set('Authorization', 'Bearer test-token');
    expect(response.status).toBe(204);
  });

  //                                            //
  // <---> Profile picture endpoint tests <---> //
  //                                            //

  it('GET /users/:id/profilePicture returns the profile picture signed URL', async () => {
    service.getProfilePicture.mockResolvedValue('https://example.com/default.jpg');
    const response = await request(app.getHttpServer()).get(`/users/${id}/profilePicture`).set('Authorization', 'Bearer test-token')
    expect(response.status).toBe(200);
    expect(response.text).toBe('https://example.com/default.jpg');
  });

  it('GET /users/:id/profilePicture returns 404 if user not found', async () => {
    service.getProfilePicture.mockRejectedValue(new NotFoundException('User not found'));
    const response = await request(app.getHttpServer()).get(`/users/${id}/profilePicture`).set('Authorization', 'Bearer test-token')
    expect(response.status).toBe(404);
  });

  it('PATCH /users/:id/profilePicture updates the profile picture', async () => {
    service.uploadProfilePicture.mockResolvedValue('picture.jpg');
    const response = await request(app.getHttpServer()).patch(`/users/${id}/profilePicture`).set('Authorization', 'Bearer test-token').send({ file: 'picture.jpg' });
    expect(response.status).toBe(200);
  });

  it('PATCH /users/:id/profilePicture returns 404 if user not found', async () => {
    service.uploadProfilePicture.mockRejectedValue(new NotFoundException('User not found'));
    const response = await request(app.getHttpServer()).patch(`/users/${id}/profilePicture`).set('Authorization', 'Bearer test-token').send({ file: 'picture.jpg' });
    expect(response.status).toBe(404);
    expect(service.uploadProfilePicture).toHaveBeenCalledWith('test-token', id, { file: 'picture.jpg' });
  });

});
