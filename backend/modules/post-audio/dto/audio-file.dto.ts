/**
 * Validation for uploaded post audio files.
 *
 * The file arrives as multipart/form-data and is parsed by Multer (through NestJS's
 * FileInterceptor) into the UploadedAudio shape below. We check the type and size here so
 * clients get a clear 400; the Storage bucket enforces the same limits as a second layer
 * (see backend/supabase/migrations/20261112000000_add_post_audio.sql).
 * NestJS file upload docs: https://docs.nestjs.com/techniques/file-upload
 */
import { BadRequestException } from '@nestjs/common';

/** The parts of a Multer file we use (avoids depending on @types/multer). */
export interface UploadedAudio {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/** 10 MB, matching the bucket's file_size_limit. */
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

/**
 * Allowed audio types and the file extension we store each one with.
 * webm/ogg are what browsers record with MediaRecorder; the rest cover uploaded files
 * (mp3, m4a from phones, wav).
 */
export const AUDIO_EXTENSIONS: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
};

/**
 * Checks an uploaded file and returns the extension to store it with.
 * Browsers often add parameters to the type (e.g. "audio/webm;codecs=opus"), so only the
 * part before ";" is compared.
 */
export function validateAudioFile(file: UploadedAudio | undefined): { file: UploadedAudio; extension: string } {
  if (!file) {
    throw new BadRequestException('Attach an audio file in the "audio" form field');
  }
  const baseType = file.mimetype.split(';')[0].trim().toLowerCase();
  const extension = AUDIO_EXTENSIONS[baseType];
  if (!extension) {
    throw new BadRequestException(
      `Unsupported audio type. Allowed: ${Object.keys(AUDIO_EXTENSIONS).join(', ')}`,
    );
  }
  if (file.size === 0) {
    throw new BadRequestException('The audio file is empty');
  }
  if (file.size > MAX_AUDIO_BYTES) {
    throw new BadRequestException('Audio files can be at most 10 MB');
  }
  return { file: { ...file, mimetype: baseType }, extension };
}
