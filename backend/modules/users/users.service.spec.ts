import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../src/integrations/supabase/supabase.service';
import { UsersService } from './users.service';
import { readFile } from 'fs/promises';

describe('UsersService', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const user = { id: '1', username: 'testuser', email: 'test@gmail.com', profile_picture: '/1/test.jpg' };
  let service: UsersService;

  beforeEach(() => {
    vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('SUPABASE_ANON_KEY', 'test-anon-key');
    vi.stubGlobal('fetch', fetchMock);
    service = new UsersService(new SupabaseService());
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  //
  // <---> getUser tests <--->
  //

  it('returns a user by ID', async () => {
    fetchMock.mockResolvedValueOnce(Response.json(user));
    const result = await service.getUserById('test-token', '1');
    expect(result).toEqual(user);
  });

  it('returns a user by username', async () => {
    fetchMock.mockResolvedValueOnce(Response.json(user));
    const result = await service.getUserByUsername('test-token', 'testuser');
    expect(result).toEqual(user);
  });

  it('throws an error when user is not found by ID', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ message: 'User Not Found' }, { status: 404 }));
    await expect(service.getUserById('test-token', '999')).rejects.toThrow();
  });

  it('throws an error when user is not found by username', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ message: 'User Not Found' }, { status: 404 }));
    await expect(service.getUserByUsername('test-token', 'nonexistentuser')).rejects.toThrow();
  });

  //
  // <---> createUser tests <-->
  //

  it('creates a new user', async () => {
    fetchMock .mockResolvedValueOnce(Response.json({ user: { id: '1' } }))
              .mockResolvedValueOnce(Response.json(user));

    const result = await service.createUser('test-token', {
      username: 'testuser',
      email: 'test@gmail.com'
    });

    expect(result).toEqual(user);
  });

  it('throws an error when information is missing', async () => {
    // Mock the Auth then create calls
    fetchMock .mockResolvedValueOnce(Response.json({ user: { id: '1' } }))
              .mockResolvedValueOnce(Response.json({ code: '23502', message: 'Missing Information', details: '' }, { status: 400 }));

    await expect(service.createUser('test-token', {
      username: '',
      email: '',  
      profile_picture: ''
    })).rejects.toThrow(BadRequestException);
  });

  it('throws an error when creating a user fails', async () => {
    fetchMock .mockResolvedValueOnce(Response.json({ user: { id: '1' } }))
              .mockResolvedValueOnce(Response.json({ message: 'Creation Failed' }, { status: 500 }));

    await expect(service.createUser('test-token', {
      username: 'testuser',
      email: 'test@gmail.com'
    })).rejects.toThrow(InternalServerErrorException);
  });

  //
  // <---> updateUser tests <--->
  //

  it('updates a user', async () => {
    fetchMock .mockResolvedValueOnce(Response.json({ user: { id: '1' } }))
              .mockResolvedValueOnce(Response.json(user));

    const result = await service.updateUser('test-token', '1', {
      username: 'updateduser',
      email: 'updated@gmail.com'
    });

    expect(result).toEqual(user);
  });

  it('throws an error when information is missing', async () => {
    // Mock the Auth then update calls
    fetchMock .mockResolvedValueOnce(Response.json({ user: { id: '1' } }))
              .mockResolvedValueOnce(Response.json({ code: '23502', message: 'Missing Information', details: '' }, { status: 400 }));

    await expect(service.updateUser('test-token', '1', {
      username: '',
      email: '',  
      profile_picture: ''
    })).rejects.toThrow(BadRequestException);
  });

  it('throws an error when updating a user fails', async () => {
    fetchMock .mockResolvedValueOnce(Response.json({ user: { id: '1' } }))
              .mockResolvedValueOnce(Response.json({ message: 'Update Failed' }, { status: 500 }));

    await expect(service.updateUser('test-token', '1', {
      username: 'updateduser',
      email: 'updated@gmail.com'
    })).rejects.toThrow(InternalServerErrorException);
  });

  //
  // <---> deleteUser tests <--->
  //

  it('deletes a user', async () => {
    fetchMock .mockResolvedValueOnce(Response.json({ user: { id: '1' } }))
              .mockResolvedValueOnce(Response.json(user));

    const result = await service.deleteUser('test-token', '1');

    expect(result).toBeUndefined();
  });

  it('throws an error when deleting a user fails', async () => {
    fetchMock .mockResolvedValueOnce(Response.json({ user: { id: '1' } }))
              .mockResolvedValueOnce(Response.json({ message: 'Delete Failed' }, { status: 500 }));

    await expect(service.deleteUser('test-token', '1')).rejects.toThrow(InternalServerErrorException);
  });

  //
  // <---> Profile Picture tests <--->
  //

  it('updates a user profile picture (jpeg)', async () => {

    // 4 Mocks required, Auth, initial fetch, upload, and URL update

    fetchMock .mockResolvedValueOnce(Response.json({ user: { id: '1' } }))
              .mockResolvedValueOnce(Response.json(user))
              .mockResolvedValueOnce(Response.json({ uploadUrl: '/1/test_sample.jpg' }))
              .mockResolvedValueOnce(Response.json(user));

    // User the sample JPEG in the users folder
    const buffer = await readFile('../backend/modules/users/test_sample.jpg');
    const file = new File([buffer], 'test_sample.jpg', { type: 'image/jpeg' });

    await expect(service.uploadProfilePicture('test-token', '1', file)).resolves.toBeUndefined();
  });

  it('updates a user profile picture (png)', async () => {

    // 4 Mocks required, Auth, initial fetch, upload, and URL update

    fetchMock .mockResolvedValueOnce(Response.json({ user: { id: '1' } }))
              .mockResolvedValueOnce(Response.json(user))
              .mockResolvedValueOnce(Response.json({ uploadUrl: '/1/test_sample.png' }))
              .mockResolvedValueOnce(Response.json(user));

    // Use the sample PNG in the users folder
    const buffer = await readFile('../backend/modules/users/test_sample.png');
    const file = new File([buffer], 'test_sample.png', { type: 'image/png' });


    await expect(service.uploadProfilePicture('test-token', '1', file)).resolves.toBeUndefined();
  });

  it('throws an error when updating a user profile picture fails', async () => {

    // 4 Mocks required, Auth, initial fetch, upload, and URL update

    fetchMock .mockResolvedValueOnce(Response.json({ user: { id: '1' } }))
              .mockResolvedValueOnce(Response.json(user))
              .mockResolvedValueOnce(Response.json({ uploadUrl: '/1/test_sample.jpg' }))
              .mockResolvedValueOnce(Response.json({ message: 'Upload Failed' }, { status: 500 }));

    const buffer = await readFile('../backend/modules/users/test_sample.jpg');
    const file = new File([buffer], 'test_sample.jpg', { type: 'image/jpeg' });

    await expect(service.uploadProfilePicture('test-token', '1', file)).rejects.toThrow(InternalServerErrorException);
  });

});
