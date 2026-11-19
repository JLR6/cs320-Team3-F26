import 'reflect-metadata';
import { type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from './app.module';
import { getCorsOptions } from './cors';

describe('Browser requests from the frontend', () => {
  let app: INestApplication;

  beforeEach(async () => {
    vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('SUPABASE_ANON_KEY', 'test-anon-key');
    vi.stubEnv('CORS_ORIGINS', undefined);
    app = await NestFactory.create(AppModule, { logger: false });
  });

  afterEach(async () => {
    await app?.close();
    vi.unstubAllEnvs();
  });

  it.each(['https://localhost:3000', 'http://localhost:3000'])(
    'allows an authenticated preflight from %s', async origin => {
      app.enableCors(getCorsOptions());
      await app.init();
      const response = await request(app.getHttpServer()).options('/posts?limit=20')
        .set('Origin', origin)
        .set('Access-Control-Request-Method', 'GET')
        .set('Access-Control-Request-Headers', 'authorization,content-type');

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe(origin);
      expect(response.headers['access-control-allow-headers'].toLowerCase()).toContain('authorization');
      expect(response.headers['access-control-allow-headers'].toLowerCase()).toContain('content-type');
      expect(response.headers['access-control-allow-methods']).toContain('PATCH');
    },
  );

  it('includes the allowed origin on an actual API error response', async () => {
    app.enableCors(getCorsOptions());
    await app.init();
    const response = await request(app.getHttpServer()).get('/posts?limit=20')
      .set('Origin', 'https://localhost:3000');
    expect(response.status).toBe(401);
    expect(response.headers['access-control-allow-origin']).toBe('https://localhost:3000');
  });

  it('withholds CORS permission from unlisted origins', async () => {
    app.enableCors(getCorsOptions());
    await app.init();
    const response = await request(app.getHttpServer()).options('/posts')
      .set('Origin', 'https://other.example')
      .set('Access-Control-Request-Method', 'GET');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('uses the configured origins for deployment', async () => {
    vi.stubEnv('CORS_ORIGINS', ' https://frontend.example, https://preview.example ');
    app.enableCors(getCorsOptions());
    await app.init();
    const response = await request(app.getHttpServer()).options('/posts')
      .set('Origin', 'https://preview.example')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type');
    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('https://preview.example');
    const local = await request(app.getHttpServer()).options('/posts')
      .set('Origin', 'https://localhost:3000')
      .set('Access-Control-Request-Method', 'GET');
    expect(local.headers['access-control-allow-origin']).toBeUndefined();
  });
});
