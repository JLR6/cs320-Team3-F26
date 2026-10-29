'use client';

import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import { DifficultyBadge } from './DifficultyBadge';
import { TagBadge } from './TagBadge';
import { LikeButton } from './LikeButton';
import { PostActionsMenu } from './PostActionsMenu';
import { formatTimeAgo } from '@/lib/format';
import { postPath } from '@/lib/routes';
import type { Post } from '@/types/post';

interface PostCardProps {
  post: Post;
  currentUserId?: string; // undefined = logged out
  onLike: (postId: string) => void;
  onEdit: (post: Post) => void;
  onDelete: (post: Post) => void;
}

// Short version of a post, shown in feeds. Clicking it opens the full post (PostDetail).
//
// How the whole card is clickable: the title <Link> has an invisible layer
// ("after:absolute after:inset-0") that stretches over the entire card.
// Buttons that must stay clickable on their own (like, menu) sit above it with "relative z-10".
export function PostCard({
  post,
  currentUserId,
  onLike,
  onEdit,
  onDelete,
}: PostCardProps) {
  const isOwner = currentUserId === post.author.id;
  const isLoggedIn = !!currentUserId;

  return (
    <Card className="relative hover:bg-muted/50">
      {/* HEADER: author + time, problem title, difficulty + tags, owner menu */}
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {post.author.username}
            </span>{' '}
            · {formatTimeAgo(post.createdAt)}
            {post.updatedAt && ' (edited)'}
          </p>

          <h3 className="text-lg font-semibold">
            <Link
              href={postPath(post.id)}
              className="after:absolute after:inset-0"
            >
              #{post.problemNumber} {post.problemName}
            </Link>
          </h3>

          <div className="flex flex-wrap items-center gap-2">
            <DifficultyBadge difficulty={post.difficulty} />
            {post.tags.map((tag) => (
              <TagBadge key={tag} tag={tag} />
            ))}
          </div>
        </div>

        {
          // only show the actions like editing and deleting if they own the post
          isOwner && (
            <div className="relative z-10">
              <PostActionsMenu
                post={post}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            </div>
          )
        }
      </CardHeader>

      {/* BODY: description, cut off after 3 lines */}
      <CardContent>
        <p className="line-clamp-3">{post.description}</p>
      </CardContent>

      {/* FOOTER: like button + comment count
       * only fill like button if user liked it
       */}
      <CardFooter className="gap-1">
        <div className="relative z-10">
          <LikeButton
            liked={post.likedByMe}
            count={post.likeCount}
            onToggle={() => onLike(post.id)}
            disabled={!isLoggedIn}
          />
        </div>
        <span className="flex items-center gap-1 px-3 text-sm text-muted-foreground">
          <MessageSquare className="h-4 w-4" />
          {post.comments.length}
        </span>
      </CardFooter>
    </Card>
  );
}
