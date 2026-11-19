// API helpers for the optional audio recording on a post.
// Backend routes: PUT/DELETE /posts/:postId/audio (see backend/modules/post-audio/README.md).
// Playing audio needs no API call: posts include "audioPath", and the PostAudio storage
// bucket is public, so we build the file's URL directly from the path.
import { createClient } from '@/lib/supabase/client';
import { apiFetch } from './client';

// Must match the backend and the storage bucket's limits.
export const POST_AUDIO_BUCKET = 'PostAudio';
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10 MB

// Allowed audio types -> file extension used when uploading a recorded Blob.
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

export type PostAudioUpload = { audioPath: string; audioUrl: string };

// "audio/webm;codecs=opus" -> "audio/webm"
const baseType = (type: string) => type.split(';')[0].trim().toLowerCase();

// Returns an error message for files the backend would reject, or null if it's fine.
// Checking here gives the user instant feedback instead of a failed upload.
export function audioFileError(file: Blob): string | null {
  if (!AUDIO_EXTENSIONS[baseType(file.type)]) {
    return 'Please choose an audio file (webm, ogg, mp3, m4a, aac or wav).';
  }
  if (file.size === 0) return 'That audio file is empty.';
  if (file.size > MAX_AUDIO_BYTES) return 'Audio files can be at most 10 MB.';
  return null;
}

// Uploads (or replaces) a post's audio. Call after the post is created, since the
// route needs the post id. Field name must be "audio".
export function uploadPostAudio(
  postId: string,
  audio: Blob,
): Promise<PostAudioUpload> {
  const extension = AUDIO_EXTENSIONS[baseType(audio.type)] ?? 'webm';
  const body = new FormData();
  body.append('audio', audio, `recording.${extension}`);
  // Don't set Content-Type: the browser adds the multipart boundary itself.
  return apiFetch<PostAudioUpload>(`/posts/${postId}/audio`, {
    method: 'PUT',
    body,
  });
}

export function deletePostAudio(postId: string): Promise<void> {
  return apiFetch<void>(`/posts/${postId}/audio`, { method: 'DELETE' });
}

// Turns a post's audioPath into a playable URL (no network request).
export function getPostAudioUrl(audioPath: string): string {
  return createClient().storage.from(POST_AUDIO_BUCKET).getPublicUrl(audioPath)
    .data.publicUrl;
}
