import { screen } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import type { Post } from '@/types/post';

export function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'p1',
    author: { id: 'user1', username: 'alice' },
    problem: {
      number: 1,
      title: 'Two Sum',
      difficulty: 'Easy',
      tags: ['HashTable'],
    },
    description: 'Used a hash map.',
    timeComplexity: '',
    solution: '',
    createdAt: new Date().toISOString(),
    updatedAt: undefined,
    likedByMe: false,
    likeCount: 3,
    comments: [],
    ...overrides,
  };
}

export async function fillPostForm(user: UserEvent, name = 'Two Sum') {
  const textboxes = screen.getAllByRole('textbox');
  const problemNumber = textboxes[0];
  await user.type(problemNumber, '1');
  const problemName = screen.queryByRole('textbox', { name: 'Problem name' });
  if (problemName) await user.type(problemName, name);
  await user.type(textboxes[2], 'Used a hash map.');
}
