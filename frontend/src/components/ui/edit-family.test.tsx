import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  EditFamily,
  type EditFamilyData,
  type EditFamilyProps,
} from './edit-family';

const data: EditFamilyData = {
  family: { id: 'family', name: 'Our Family' },
  owner: { family_id: 'family', user_id: 'owner' },
  admins: [
    { family_id: 'family', user_id: 'admin' },
    { family_id: 'family', user_id: 'other-admin' },
    { family_id: 'another-family', user_id: 'member' },
  ],
  members: [
    { user_id: 'owner', username: 'Owner' },
    { user_id: 'admin', username: 'Admin' },
    { user_id: 'other-admin', username: 'Other admin' },
    { user_id: 'member', username: 'Member' },
  ],
};

function setup(overrides: Partial<EditFamilyProps> = {}) {
  const props: EditFamilyProps = {
    data,
    currentUserId: 'owner',
    open: true,
    onOpenChange: vi.fn(),
    onUpdateFamily: vi.fn().mockResolvedValue(undefined),
    onPromoteAdmin: vi.fn().mockResolvedValue(undefined),
    onDemoteAdmin: vi.fn().mockResolvedValue(undefined),
    onRemoveMember: vi.fn().mockResolvedValue(undefined),
    onInvite: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  const user = userEvent.setup();
  render(<EditFamily {...props} />);
  return { user, props };
}

describe('EditFamily', () => {
  it('saves trimmed names on Enter and ignores unchanged names on blur', async () => {
    const { user, props } = setup();
    const name = screen.getByLabelText('Family Name');
    await user.click(name);
    await user.tab();
    expect(props.onUpdateFamily).not.toHaveBeenCalled();
    await user.clear(name);
    await user.type(name, '  New Family  {Enter}');
    await waitFor(() =>
      expect(props.onUpdateFamily).toHaveBeenCalledWith('family', {
        name: 'New Family',
      }),
    );
  });

  it('rejects a blank family name', async () => {
    const { user, props } = setup();
    await user.clear(screen.getByLabelText('Family Name'));
    await user.tab();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Family name is required.',
    );
    expect(props.onUpdateFamily).not.toHaveBeenCalled();
  });

  it('rejects invalid email addresses without sending invitations', async () => {
    const { user, props } = setup();
    await user.type(screen.getByLabelText('Invite Members'), 'invalid');
    await user.click(screen.getByRole('button', { name: 'Invite' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Enter a valid email address.',
    );
    expect(screen.getByLabelText('Invite Members')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(props.onInvite).not.toHaveBeenCalled();
  });

  it('deduplicates recipients case-insensitively and includes unfinished addresses on submit', async () => {
    const { user, props } = setup();
    await user.type(
      screen.getByLabelText('Invite Members'),
      'alex@example.com;ALEX@example.com;sam@example.com',
    );
    await user.click(screen.getByRole('button', { name: 'Invite' }));
    await waitFor(() =>
      expect(props.onInvite).toHaveBeenCalledWith('family', [
        'alex@example.com',
        'sam@example.com',
      ]),
    );
    expect(
      screen.queryByRole('button', { name: 'Remove alex@example.com' }),
    ).not.toBeInTheDocument();
  });

  it('lets recipients be removed with a button or Backspace', async () => {
    const { user } = setup();
    const emails = screen.getByLabelText('Invite Members');
    await user.type(emails, 'alex@example.com;sam@example.com;');
    await user.click(
      screen.getByRole('button', { name: 'Remove alex@example.com' }),
    );
    await user.click(emails);
    await user.keyboard('{Backspace}');
    expect(
      screen.queryByRole('button', { name: 'Remove sam@example.com' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Invite' })).toBeDisabled();
  });

  it('retains recipients after a failed invitation and allows retry', async () => {
    const onInvite = vi
      .fn()
      .mockRejectedValueOnce(new Error('Invitation failed'))
      .mockResolvedValueOnce(undefined);
    const { user } = setup({ onInvite });
    await user.type(
      screen.getByLabelText('Invite Members'),
      'alex@example.com',
    );
    await user.click(screen.getByRole('button', { name: 'Invite' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invitation failed',
    );
    expect(
      screen.getByRole('button', { name: 'Remove alex@example.com' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Invite' }));
    await waitFor(() => expect(onInvite).toHaveBeenCalledTimes(2));
  });

  it('disables editing while an invitation is pending', async () => {
    let finish = () => {};
    const onInvite = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const { user } = setup({ onInvite });
    await user.type(
      screen.getByLabelText('Invite Members'),
      'alex@example.com',
    );
    await user.click(screen.getByRole('button', { name: 'Invite' }));
    expect(screen.getByLabelText('Family Name')).toBeDisabled();
    expect(screen.getByLabelText('Invite Members')).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Invite' }));
    expect(onInvite).toHaveBeenCalledTimes(1);
    finish();
    await waitFor(() =>
      expect(screen.getByLabelText('Family Name')).toBeEnabled(),
    );
  });

  it('keeps regular members read-only, including admins of another family', () => {
    setup({ currentUserId: 'member' });
    expect(screen.getByLabelText('Family Name')).toBeDisabled();
    expect(screen.getByLabelText('Invite Members')).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: /^Manage / }),
    ).not.toBeInTheDocument();
  });

  it('allows admins to remove regular members but protects other admins, the owner and themselves', async () => {
    const { user, props } = setup({ currentUserId: 'admin' });
    expect(screen.getByLabelText('Family Name')).toBeEnabled();
    expect(
      screen.queryByRole('button', { name: 'Manage Owner' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Manage Admin' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Manage Other admin' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Manage Member' }));
    expect(
      screen.queryByRole('button', { name: 'Promote to Admin' }),
    ).not.toBeInTheDocument();
    await user.click(
      await screen.findByRole('button', { name: 'Remove from Family' }),
    );
    expect(props.onRemoveMember).toHaveBeenCalledWith('family', 'member');
  });

  it('allows owners to promote members and demote admins, but never remove themselves', async () => {
    const { user, props } = setup();
    expect(
      screen.queryByRole('button', { name: 'Manage Owner' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Manage Member' }));
    await user.click(
      await screen.findByRole('button', { name: 'Promote to Admin' }),
    );
    expect(props.onPromoteAdmin).toHaveBeenCalledWith('family', {
      user_id: 'member',
    });
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Manage Admin' }));
    await user.click(
      await screen.findByRole('button', { name: 'Demote to Member' }),
    );
    expect(props.onDemoteAdmin).toHaveBeenCalledWith('family', 'admin');
  });

  it.each([
    { ...data, owner: { family_id: 'another-family', user_id: 'owner' } },
    {
      ...data,
      members: data.members.filter((member) => member.user_id !== 'owner'),
    },
  ])('disables management when owner data is inconsistent', (invalidData) => {
    setup({ data: invalidData, currentUserId: 'admin' });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Family owner information is missing or inconsistent',
    );
    expect(screen.getByLabelText('Family Name')).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: /^Manage / }),
    ).not.toBeInTheDocument();
  });

  it('reports unexpected save failures', async () => {
    const { user } = setup({
      onUpdateFamily: vi.fn().mockRejectedValue('unavailable'),
    });
    await user.clear(screen.getByLabelText('Family Name'));
    await user.type(screen.getByLabelText('Family Name'), 'New name{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to save changes. Please try again.',
    );
  });

  it('accepts pasted recipient lists and preserves invalid paste for correction', async () => {
    const { user, props } = setup();
    await user.click(screen.getByLabelText('Invite Members'));
    await user.paste('alex@example.com; invalid');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Enter a valid email address.',
    );
    expect(screen.getByLabelText('Invite Members')).toHaveValue(
      'alex@example.com; invalid',
    );
    await user.clear(screen.getByLabelText('Invite Members'));
    await user.paste('alex@example.com; sam@example.com');
    await user.click(screen.getByRole('button', { name: 'Invite' }));
    expect(props.onInvite).toHaveBeenCalledWith('family', [
      'alex@example.com',
      'sam@example.com',
    ]);
  });

  it('lets a single pasted address stay editable until submitted', async () => {
    const { user, props } = setup();
    await user.click(screen.getByLabelText('Invite Members'));
    await user.paste('alex@example.com');
    expect(screen.getByLabelText('Invite Members')).toHaveValue(
      'alex@example.com',
    );
    await user.click(screen.getByRole('button', { name: 'Invite' }));
    expect(props.onInvite).toHaveBeenCalledWith('family', ['alex@example.com']);
  });

  it('hides management actions when integration callbacks are absent', () => {
    setup({
      onUpdateFamily: undefined,
      onPromoteAdmin: undefined,
      onDemoteAdmin: undefined,
      onRemoveMember: undefined,
      onInvite: undefined,
    });
    expect(screen.getByLabelText('Family Name')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Invite' })).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: /^Manage / }),
    ).not.toBeInTheDocument();
  });

  it('shows the empty member state when only managers remain', () => {
    setup({
      data: {
        ...data,
        members: data.members.filter((member) => member.user_id !== 'member'),
      },
    });
    expect(screen.getByText('No members yet.')).toBeInTheDocument();
  });

  it('requests closing the popup', async () => {
    const { user, props } = setup();
    await user.click(screen.getByRole('button', { name: 'Close edit family' }));
    expect(props.onOpenChange).toHaveBeenCalledWith(false, expect.anything());
  });
});
