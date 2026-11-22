import { render, screen } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { createElement, type ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Post, PostComment } from '@/types/post';

// Render a component that uses React Query, with a fresh cache per test.
// Retries are off so a failed request shows its error right away.
export function renderWithQuery(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(createElement(QueryClientProvider, { client }, ui));
}

export function makeComment(overrides: Partial<PostComment> = {}): PostComment {
  return {
    id: 'c1',
    postId: 'p1',
    author: { id: 'user2', username: 'bob' },
    content: 'Nice!',
    likeCount: 0,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

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
