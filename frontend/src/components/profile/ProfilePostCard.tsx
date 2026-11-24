import Link from 'next/link';
import { Heart, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DIFFICULTY_CLASS, formatCount, timeAgo } from '@/lib/profile';
import type { ProfilePost } from '@/lib/api/profile-posts';
import { ProfileAvatar } from './ProfileAvatar';

// The grey bullet between parts of the top line
function Dot() {
  return (
    <span aria-hidden="true" className="mx-2 text-muted-foreground">
      •
    </span>
  );
}

// One post on a profile: author • problem (difficulty) • time, description, tags, counts.
// TODO: swap for Arjya's PostCard once Posts-UI is merged so likes/editing work here too.
export function ProfilePostCard({ post }: { post: ProfilePost }) {
  const author = post.author.username ?? 'Unknown user';
  const title = post.problemName ?? `Problem ${post.problemNumber}`;

  return (
    <article className="flex gap-3">
      <ProfileAvatar name={author} picture={post.author.profilePicture} />
      <div className="min-w-0 flex-1 rounded-lg bg-card p-5 shadow-[0_0_8px_rgba(0,0,0,0.1)]">
        {/* Top line */}
        <p className="text-sm">
          <span className="font-bold">{author}</span>
          <Dot />
          <Link
            href={`/posts/${post.id}`}
            className="font-semibold text-muted-foreground hover:underline"
          >
            {post.problemNumber}. {title}
          </Link>
          {post.difficulty && (
            <span
              className={cn('font-semibold', DIFFICULTY_CLASS[post.difficulty])}
            >
              {' '}
              ({post.difficulty})
            </span>
          )}
          {post.createdAt && (
            <>
              <Dot />
              <span className="font-semibold text-muted-foreground">
                {timeAgo(post.createdAt)}
              </span>
            </>
          )}
        </p>

        {/* Description with the orange "see solution" link */}
        <p className="mt-3 text-sm">
          {post.description}{' '}
          <Link
            href={`/posts/${post.id}`}
            className="font-semibold text-primary hover:underline"
          >
            see solution
          </Link>
        </p>

        {/* Tags */}
        {post.tags.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-x-3 text-sm text-muted-foreground">
            {post.tags.map((tag) => (
              <li key={tag}>#{tag}</li>
            ))}
          </ul>
        )}

        {/* Comment and like counts */}
        <div className="mt-4 flex justify-end gap-6 text-sm font-semibold text-muted-foreground">
          <span
            className="flex items-center gap-1.5"
            aria-label={`${post.comments.length} comments`}
          >
            <MessageCircle aria-hidden="true" className="size-4" />
            {formatCount(post.comments.length)}
          </span>
          <span
            className="flex items-center gap-1.5"
            aria-label={`${post.likeCount} likes`}
          >
            <Heart aria-hidden="true" className="size-4" />
            {formatCount(post.likeCount)}
          </span>
        </div>
      </div>
    </article>
  );
}
