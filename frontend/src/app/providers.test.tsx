// this is a test for checking that the tanstack boilerplate works

import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { Providers } from './providers';

test('renders children and covers provider initialization', () => {
  // mocks the element behavior and checks that they are there
  render(<Providers><div>Test Child</div></Providers>);
  expect(screen.getByText('Test Child')).toBeInTheDocument();
});
