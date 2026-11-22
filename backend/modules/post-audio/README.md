# Post Audio API

A post can have one optional audio recording, for example the author talking through their
solution. Audio is uploaded separately from the post's text, after the post exists.

| Method | Route | Who | Result |
| --- | --- | --- | --- |
| PUT | `/posts/:postId/audio` | the post's author | Adds or replaces the audio; `{ "audioPath", "audioUrl" }` (200) |
| DELETE | `/posts/:postId/audio` | the post's author | Removes the audio (204) |

Both need `Authorization: Bearer <Supabase access token>`.

## Uploading

Send `multipart/form-data` with the file in a field called **`audio`**:

```ts
const form = new FormData();
form.append('audio', blob, 'recording.webm'); // a recorded Blob or an <input type="file"> File
await fetch(`${API_URL}/posts/${postId}/audio`, {
  method: 'PUT',
  headers: { Authorization: `Bearer ${token}` }, // don't set Content-Type; the browser adds the boundary
  body: form,
});
```

- Allowed types: `audio/webm`, `audio/ogg` (what browsers record with `MediaRecorder`),
  `audio/mpeg` (mp3), `audio/mp4` / `audio/x-m4a` (m4a), `audio/aac`, `audio/wav`.
- Max size: **10 MB**.
- Uploading again replaces the old recording, and the old file is deleted.

## Playing audio

Post responses (`GET /posts`, `GET /posts/following`, `GET /posts/:id`) include
**`audioPath`**: `null` when there's no recording, otherwise the file's path in the
`PostAudio` bucket. The bucket is public, so the frontend turns the path into a URL with no
extra request:

```ts
supabase.storage.from('PostAudio').getPublicUrl(post.audioPath).data.publicUrl
```

## Errors

| Status | When |
| --- | --- |
| 400 | no file, wrong field name, unsupported type, empty file, or non-UUID post id |
| 401 | missing/invalid token |
| 403 | the post belongs to someone else |
| 404 | post not found; or DELETE on a post with no audio |
| 413 | file over 10 MB |
| 500 | storage or database error (details hidden) |

## How it's stored

Migration `backend/supabase/migrations/20261112000000_add_post_audio.sql`:

- adds `posts.audio_path`;
- creates the public `PostAudio` bucket (10 MB limit, audio types only);
- Storage RLS: you can only upload, replace or delete files in your own folder
  (`<your user id>/...`);
- recreates the `post_details` / `following_post_details` views with `"audioPath"`.

Files are named `<user_id>/<post_id>-<timestamp>.<ext>`. The timestamp gives every upload a
new URL, so browsers never play a cached old recording.

Deleting a post (`DELETE /posts/:id`) also deletes its audio file.

## Tests

`npm --prefix backend run test -- modules/post-audio`
