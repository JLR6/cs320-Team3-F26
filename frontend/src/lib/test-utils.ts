// Utility functions for testing.

import { screen } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import type { Post } from '@/types/post';

// just an example post but we can change individual details if needed with overrides
export function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'p1',
    author: { id: 'user1', username: 'alice' },
    problemNumber: 1,
    problemName: 'Two Sum',
    difficulty: 'Easy',
    description: 'Used a hash map.',
    tags: ['HashTable'],
    timeComplexity: '',
    spaceComplexity: '',
    solutionUrl: '',
    createdAt: new Date().toISOString(),
    updatedAt: undefined,
    likedByMe: false,
    likeCount: 3,
    comments: [],
    ...overrides,
  } as Post;
}

// Fills form fields for making posts.
export async function fillPostForm(user: UserEvent, name = 'Two Sum') {
  await user.type(screen.getByLabelText('Problem #'), '1');
  await user.type(screen.getByLabelText('Problem name'), name);
  await user.type(screen.getByLabelText('Description'), 'Used a hash map.');
}
