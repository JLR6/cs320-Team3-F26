/**
 * Tests for validateAudioFile: which uploaded files are accepted, which extension they're
 * stored with, and the 400 errors for everything else. Plain function, nothing faked.
 */
import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { AUDIO_EXTENSIONS, MAX_AUDIO_BYTES, validateAudioFile, type UploadedAudio } from './audio-file.dto';

const audio = (overrides: Partial<UploadedAudio> = {}): UploadedAudio => ({
  originalname: 'recording.webm',
  mimetype: 'audio/webm',
  size: 1024,
  buffer: Buffer.from('audio-bytes'),
  ...overrides,
});

describe('validateAudioFile', () => {
  it.each(Object.entries(AUDIO_EXTENSIONS))('accepts %s and stores it as .%s', (mimetype, extension) => {
    expect(validateAudioFile(audio({ mimetype })).extension).toBe(extension);
  });

  it('ignores codec parameters and casing in the type, and stores the plain type', () => {
    const result = validateAudioFile(audio({ mimetype: 'Audio/WebM; codecs=opus' }));
    expect(result.extension).toBe('webm');
    expect(result.file.mimetype).toBe('audio/webm');
  });

  it('accepts a file of exactly 10 MB', () => {
    expect(validateAudioFile(audio({ size: MAX_AUDIO_BYTES })).extension).toBe('webm');
  });

  it.each([
    ['no file', undefined],
    ['an image', audio({ mimetype: 'image/png' })],
    ['a video', audio({ mimetype: 'video/webm' })],
    ['an unknown audio type', audio({ mimetype: 'audio/flac' })],
    ['an empty file', audio({ size: 0 })],
    ['a file over 10 MB', audio({ size: MAX_AUDIO_BYTES + 1 })],
  ])('rejects %s', (_label, file) => {
    expect(() => validateAudioFile(file)).toThrow(BadRequestException);
  });

  it('gives clear error messages', () => {
    expect(() => validateAudioFile(undefined)).toThrow('Attach an audio file in the "audio" form field');
    expect(() => validateAudioFile(audio({ mimetype: 'text/plain' }))).toThrow(/Unsupported audio type/);
    expect(() => validateAudioFile(audio({ size: 0 }))).toThrow('The audio file is empty');
    expect(() => validateAudioFile(audio({ size: MAX_AUDIO_BYTES + 1 }))).toThrow('Audio files can be at most 10 MB');
  });
});
