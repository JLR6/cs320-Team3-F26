import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  AppCard,
  AppCardButton,
  AppCardContent,
  AppCardHeader,
  AppCardInput,
} from './app-card';

describe('AppCard components', () => {
  // renders card content with its custom classes
  it('renders card content with its custom classes', () => {
    render(
      <AppCard data-testid="card">
        <AppCardHeader size="lg">A heading</AppCardHeader>
        <AppCardContent className="extra">Content</AppCardContent>
      </AppCard>,
    );

    expect(screen.getByTestId('card')).toHaveClass('w-96');
    expect(screen.getByText('A heading')).toHaveClass('text-lg');
    expect(screen.getByText('Content')).toHaveClass('extra');
  });

  // renders labeled and unlabeled password inputs
  it('renders labeled and unlabeled password inputs', () => {
    render(
      <>
        <AppCardInput label="Password" asPassword />
        <AppCardInput aria-label="unlabeled" />
      </>,
    );

    expect(screen.getByLabelText('Password')).toHaveAttribute(
      'type',
      'password',
    );
    expect(screen.getByRole('textbox', { name: 'unlabeled' })).toHaveClass(
      'mt-5',
    );
  });

  // applies button variants and forwards button events
  it('applies button variants and forwards button events', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <AppCardButton size="lg" variant="blue" onClick={onClick}>
        Continue
      </AppCardButton>,
    );

    const button = screen.getByRole('button', { name: 'Continue' });
    expect(button).toHaveClass('bg-[#027BFF]', 'w-full');
    await user.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });
});
