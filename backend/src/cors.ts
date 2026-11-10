import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

export function getCorsOptions(): CorsOptions {
  const origins = process.env.CORS_ORIGINS ?? 'http://localhost:3000,https://localhost:3000';
  return {
    origin: origins.split(',').map(origin => origin.trim()).filter(Boolean),
    allowedHeaders: ['Authorization', 'Content-Type'],
  };
}
