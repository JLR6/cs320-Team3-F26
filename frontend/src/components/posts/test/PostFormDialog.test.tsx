import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PostFormDialog } from '../PostFormDialog';
import { makePost } from '@/lib/test-utils';

function renderDialog(onSubmit = vi.fn()) {
  // render an open dialog with a replaceable submit handler
  render(<PostFormDialog open onOpenChange={vi.fn()} onSubmit={onSubmit} />);
  return onSubmit;
}

describe('PostFormDialog', () => {
  // confirm that submission contains only post fields
  it('submits only fields that belong to the post', async () => {
    const user = userEvent.setup();
    const onSubmit = renderDialog();
    const textboxes = screen.getAllByRole('textbox');

    await user.type(textboxes[0], '1');
    await user.type(textboxes[2], 'used a hash map');
    await user.type(textboxes[3], 'O(n)');
    await user.click(screen.getByRole('button', { name: 'Post' }));

    expect(onSubmit).toHaveBeenCalledWith({
      problemNumber: 1,
      description: 'used a hash map',
      solutionUrl: '',
      timeComplexity: 'O(n)',
    });
  });

  // confirm that editing loads the problem number without extra details
  it('loads problem details from the problem when editing', () => {
    render(
      <PostFormDialog
        open
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        post={makePost({
          problem: {
            number: 42,
            title: 'Trapping Rain Water',
            difficulty: 'Hard',
            tags: ['Array', 'TwoPointers'],
          },
        })}
      />,
    );

    expect(screen.getByDisplayValue('42')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Trapping Rain Water')).toBeNull();
    expect(screen.queryByText('Hard')).toBeNull();
  });
});
