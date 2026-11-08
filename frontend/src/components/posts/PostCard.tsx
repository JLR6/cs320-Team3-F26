import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import {
  DIFFICULTY_COLOR,
  formatCount,
  postTags,
  problemTitle,
  timeAgo,
} from '@/lib/utils';
import type { Post } from '@/types/post';
import { LikeButton } from './LikeButton';
import { PostActionsMenu } from './PostActionsMenu';
import { UserAvatar } from './presentation/UserAvatar';

type Props = {
  post: Post;
  isOwner: boolean;
  canInteract: boolean;
  onLike: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

// One post in the feed. The whole card links to the post page;
// buttons use "relative z-10" so they stay clickable on top of that link.
export function PostCard({
  post,
  isOwner,
  canInteract,
  onLike,
  onEdit,
  onDelete,
}: Props) {
  return (
    <article className="flex gap-3">
      <UserAvatar name={post.author.username} className="size-9" />
      <div className="relative min-w-0 flex-1 rounded-xl bg-muted/60 p-4">
        {/* Top line: author • problem (difficulty) • time */}
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm">
            <span className="font-semibold">{post.author.username}</span>
            <span className="mx-2 text-muted-foreground">•</span>
            <Link
              href={`/posts/${post.id}`}
              className="font-semibold after:absolute after:inset-0"
            >
              {problemTitle(post)}
              {post.difficulty && (
                <span className={DIFFICULTY_COLOR[post.difficulty]}>
                  {' '}
                  ({post.difficulty})
                </span>
              )}
            </Link>
            <span className="mx-2 text-muted-foreground">•</span>
            <span className="text-muted-foreground">
              {timeAgo(post.createdAt)}
            </span>
          </p>
          {isOwner && <PostActionsMenu onEdit={onEdit} onDelete={onDelete} />}
        </div>

        {/* Description (3 lines max) */}
        <p className="mt-1 line-clamp-3 text-sm">
          {post.description}{' '}
          <Link
            href={`/posts/${post.id}`}
            className="relative z-10 font-medium text-primary"
          >
            see solution
          </Link>
        </p>

        {/* Tags */}
        <div className="mt-2 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
          {postTags(post).map((t) => (
            <span key={t}>#{t}</span>
          ))}
        </div>

        {/* Comments + likes */}
        <div className="mt-2 flex items-center justify-end gap-4">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <MessageCircle className="size-4" />{' '}
            {formatCount(post.comments.length)}
          </span>
          <LikeButton
            count={post.likeCount}
            liked={post.likedByMe}
            disabled={!canInteract}
            onClick={onLike}
          />
        </div>
      </div>
    </article>
  );
}
