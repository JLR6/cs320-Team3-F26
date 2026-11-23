// Plays a post's audio recording. Renders nothing when the post has no audio.
//
// In the post card: <AudioPlayer audioPath={post.audioPath} />
import { getPostAudioUrl } from '@/lib/api/post-audio';

type Props = {
  audioPath: string | null | undefined;
  className?: string;
};

export function AudioPlayer({ audioPath, className }: Props) {
  if (!audioPath) return null;
  return (
    <audio
      controls
      // Don't download every clip in the feed up front; load when the user presses play.
      preload="none"
      src={getPostAudioUrl(audioPath)}
      aria-label="Post audio"
      className={className ?? 'h-9 w-full'}
    />
  );
}
