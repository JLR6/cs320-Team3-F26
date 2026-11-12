import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { createChallenge } = vi.hoisted(() => ({ createChallenge: vi.fn() }));
// use a fake API response instead of actually creating challenges
vi.mock('@/lib/api/challenges', () => ({ createChallenge }));

import { CreateChallengeForm } from './create-challenge-form';

describe('CreateChallengeForm', () => {
  const onCreated = vi.fn();
  const onCancel = vi.fn();
  beforeEach(() => vi.clearAllMocks());
  function renderForm() {
    return render(
      <CreateChallengeForm
        familyId="family1"
        onCreated={onCreated}
        onCancel={onCancel}
      />,
    );
  }

  // make sure all the inputs show up
  it('shows the challenge fields', () => {
    renderForm();
    expect(screen.getByLabelText('Easy')).toBeInTheDocument();
    expect(screen.getByLabelText('Medium')).toBeInTheDocument();
    expect(screen.getByLabelText('Hard')).toBeInTheDocument();
    expect(screen.getByLabelText('Start Date')).toBeInTheDocument();
    expect(screen.getByLabelText('End Date')).toBeInTheDocument();
    expect(screen.getByLabelText('Reward')).toBeInTheDocument();
    expect(screen.getByLabelText('Punishment')).toBeInTheDocument();
  });

  // the same problem shouldn't be added twice
  it('rejects duplicate problem numbers', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByPlaceholderText('1, 15, 200'), '1, 1');
    await user.click(screen.getByRole('button', { name: 'Create Challenge' }));
    expect(screen.getByRole('alert')).toHaveTextContent('unique');
    expect(createChallenge).not.toHaveBeenCalled();
  });

  // check that submitting the form calls the API
  it('creates a challenge with valid inputs', async () => {
    const user = userEvent.setup();
    const challenge = { id: 'challenge1' };
    createChallenge.mockResolvedValue(challenge);
    renderForm();
    await user.click(screen.getByRole('button', { name: 'Create Challenge' }));
    await waitFor(() => {
      expect(createChallenge).toHaveBeenCalledWith(
        'family1',
        expect.objectContaining({
          required_easy: 0,
          required_medium: 0,
          required_hard: 0,
          problem_order: [],
        }),
      );
    });

    expect(onCreated).toHaveBeenCalledWith(challenge);
  });

  // show an error if something goes wrong with the request
  it('shows an error when the request fails', async () => {
    const user = userEvent.setup();
    createChallenge.mockRejectedValue(new Error('Network error'));
    renderForm();
    await user.click(screen.getByRole('button', { name: 'Create Challenge' }));
    expect(
      await screen.findByText(/Could not create the challenge/),
    ).toBeInTheDocument();
  });

  it('lets the user cancel', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});