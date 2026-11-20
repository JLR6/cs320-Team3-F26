'use client';

import * as React from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { Avatar } from '@base-ui/react/avatar';
import { ArrowUp, ArrowDown, LogOut, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverMenuButton,
  PopoverTriggerMore,
} from '@/components/ui/popover';

export interface EditFamilyData {
  family: { id: string; name: string };
  owner: { family_id: string; user_id: string };
  admins: readonly { family_id: string; user_id: string }[];
  members: readonly {
    user_id: string;
    username: string;
    profile_picture?: string | null;
  }[];
}

export interface EditFamilyProps {
  data: EditFamilyData;
  currentUserId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** PATCH /families/:familyId. Saves on blur or Enter. */
  onUpdateFamily?: (familyId: string, patch: { name: string }) => Promise<void>;
  /** POST /families/:familyId/admins */
  onPromoteAdmin?: (
    familyId: string,
    body: { user_id: string },
  ) => Promise<void>;
  /** DELETE /families/:familyId/admins/:userId */
  onDemoteAdmin?: (familyId: string, userId: string) => Promise<void>;
  /** DELETE /families/:familyId/members/:userId */
  onRemoveMember?: (familyId: string, userId: string) => Promise<void>;
  /** Optional integration: invitations are not part of the families endpoints. */
  onInvite?: (familyId: string, emails: string[]) => Promise<void>;
}

export function EditFamily(props: EditFamilyProps) {
  return (
    <Dialog.Root open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/10 backdrop-blur-[1px]" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 flex max-h-[min(540px,90dvh)] w-[368px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl bg-background text-foreground shadow-lg outline-none">
          <div className="flex shrink-0 items-center justify-between px-3 py-2.5">
            <Dialog.Title className="text-[13px] font-bold">
              Edit Family
            </Dialog.Title>
            <Dialog.Close
              render={<Button variant="ghost" size="icon-xs" />}
              aria-label="Close edit family"
            >
              <X className="size-3.5 text-muted-foreground" />
            </Dialog.Close>
          </div>
          <EditFamilyBody key={props.data.family.id} {...props} />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function EditFamilyBody({
  data,
  currentUserId,
  onUpdateFamily,
  onPromoteAdmin,
  onDemoteAdmin,
  onRemoveMember,
  onInvite,
}: EditFamilyProps) {
  const id = React.useId();
  const [name, setName] = React.useState(data.family.name);
  const [emails, setEmails] = React.useState('');
  const [recipients, setRecipients] = React.useState<string[]>([]);
  const [emailError, setEmailError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const pending = React.useRef(false);
  const [error, setError] = React.useState('');
  const familyId = data.family.id;
  const ownerId = data.owner.family_id === familyId ? data.owner.user_id : null;
  const adminIds = new Set(
    data.admins
      .filter((admin) => admin.family_id === familyId)
      .map((admin) => admin.user_id),
  );
  const isOwner = currentUserId === ownerId;
  const canManage = isOwner || adminIds.has(currentUserId);
  const managers = data.members
    .filter(
      (member) => member.user_id === ownerId || adminIds.has(member.user_id),
    )
    .sort(
      (a, b) => Number(b.user_id === ownerId) - Number(a.user_id === ownerId),
    );
  const members = data.members.filter(
    (member) => member.user_id !== ownerId && !adminIds.has(member.user_id),
  );

  async function run(action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Unable to save changes. Please try again.',
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  function addEmails(value: string): string[] | null {
    const candidates = value.split(/[,;\s]+/).filter(Boolean);
    if (candidates.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      setEmailError('Enter a valid email address.');
      return null;
    }
    const combined = [...recipients];
    for (const email of candidates) {
      if (
        !combined.some(
          (existing) => existing.toLowerCase() === email.toLowerCase(),
        )
      )
        combined.push(email);
    }
    setRecipients(combined);
    setEmails('');
    setEmailError('');
    return combined;
  }

  function saveName() {
    if (!canManage || !onUpdateFamily || name.trim() === data.family.name)
      return;
    if (!name.trim()) {
      setError('Family name is required.');
      return;
    }
    void run(() => onUpdateFamily(familyId, { name: name.trim() }));
  }

  function row(member: EditFamilyData['members'][number]) {
    const owner = member.user_id === ownerId;
    const admin = adminIds.has(member.user_id);
    const canAct =
      !owner &&
      member.user_id !== currentUserId &&
      (admin ? isOwner : canManage);
    return (
      <div
        key={member.user_id}
        className="flex min-h-[33px] items-center gap-2 px-1"
      >
        <Avatar.Root className="relative size-7 shrink-0 overflow-hidden rounded-full bg-[#c4c4c4]">
          <Avatar.Image
            src={member.profile_picture ?? undefined}
            alt=""
            className="size-full object-cover"
          />
          <Avatar.Fallback
            aria-hidden="true"
            className="relative block size-full"
          >
            <span className="absolute top-[5px] left-2 size-3 rounded-full bg-white" />
            <span className="absolute -bottom-1 left-1 h-4 w-5 rounded-t-full bg-white" />
          </Avatar.Fallback>
        </Avatar.Root>
        <span
          className="min-w-0 truncate font-semibold"
          title={member.username}
        >
          {member.username}
        </span>
        {owner && (
          <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[8px] text-muted-foreground">
            family owner
          </span>
        )}
        {canAct &&
          (onRemoveMember ||
            (admin ? onDemoteAdmin : isOwner && onPromoteAdmin)) && (
            <Popover>
              <PopoverTriggerMore
                className="m-0 ml-auto size-6 p-1 [&_svg]:size-3"
                aria-label={`Manage ${member.username}`}
                disabled={busy}
              />
              <PopoverContent className="w-[148px] gap-0" align="start">
                {isOwner && (admin ? onDemoteAdmin : onPromoteAdmin) && (
                  <PopoverMenuButton
                    disabled={busy}
                    className="h-7 text-[10px] [&_svg]:size-3"
                    onClick={() =>
                      void run(() =>
                        admin
                          ? onDemoteAdmin!(familyId, member.user_id)
                          : onPromoteAdmin!(familyId, {
                              user_id: member.user_id,
                            }),
                      )
                    }
                  >
                    {admin ? <ArrowDown /> : <ArrowUp />}
                    {admin ? 'Demote to Member' : 'Promote to Admin'}
                  </PopoverMenuButton>
                )}
                {onRemoveMember && (
                  <PopoverMenuButton
                    disabled={busy}
                    className="h-7 text-[10px] [&_svg]:size-3"
                    onClick={() =>
                      void run(() => onRemoveMember(familyId, member.user_id))
                    }
                  >
                    <LogOut />
                    Remove from Family
                  </PopoverMenuButton>
                )}
              </PopoverContent>
            </Popover>
          )}
      </div>
    );
  }

  return (
    <div
      className="overflow-y-auto px-3 pb-4 text-[10px] leading-4"
      aria-busy={busy}
    >
      <div
        aria-hidden="true"
        className="mx-auto mb-3 h-[114px] w-[114px] rounded-md border border-black/[0.025] bg-[#f5f5f5] dark:bg-secondary"
      />
      <label htmlFor={`${id}-name`} className="font-semibold">
        Family Name
      </label>
      <Input
        id={`${id}-name`}
        value={name}
        onChange={(event) => setName(event.target.value)}
        onBlur={saveName}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
        maxLength={100}
        disabled={busy || !canManage || !onUpdateFamily}
        className="mt-0.5 mb-1.5 h-6 rounded-md border-border/50 text-[10px] md:text-[10px]"
      />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!canManage || !onInvite || busy) return;
          const addresses = addEmails(emails);
          if (addresses?.length)
            void run(async () => {
              await onInvite(familyId, addresses);
              setRecipients([]);
            });
        }}
      >
        <label htmlFor={`${id}-emails`} className="font-semibold">
          Invite Members
        </label>
        <div className="mt-0.5 mb-1.5 rounded-md border border-border/50 p-2">
          <div className="flex min-h-6 flex-wrap items-center gap-1 rounded-sm focus-within:ring-1 focus-within:ring-ring">
            {recipients.map((email) => (
              <span
                key={email}
                className="inline-flex max-w-full items-center gap-1 rounded-sm bg-sky-50 px-1.5 py-0.5 text-foreground dark:bg-sky-950"
              >
                <span className="break-all">{email}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="size-4 shrink-0"
                  aria-label={`Remove ${email}`}
                  disabled={busy || !canManage}
                  onClick={() =>
                    setRecipients((current) =>
                      current.filter((item) => item !== email),
                    )
                  }
                >
                  <X className="size-3" />
                </Button>
              </span>
            ))}
            <input
              id={`${id}-emails`}
              type="text"
              inputMode="email"
              autoComplete="off"
              value={emails}
              onChange={(event) => {
                setEmails(event.target.value);
                setEmailError('');
              }}
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing) return;
                if ([' ', 'Enter', ',', ';'].includes(event.key)) {
                  event.preventDefault();
                  addEmails(emails);
                } else if (event.key === 'Backspace' && !emails) {
                  setRecipients((current) => current.slice(0, -1));
                }
              }}
              onPaste={(event) => {
                const text = event.clipboardData.getData('text');
                if (/[,;\s]/.test(text.trim())) {
                  event.preventDefault();
                  const value = emails + text;
                  if (!addEmails(value)) setEmails(value);
                }
              }}
              placeholder={
                recipients.length
                  ? 'Add another email'
                  : 'Enter E-mails to send invitations'
              }
              disabled={busy || !canManage}
              aria-invalid={!!emailError}
              aria-describedby={emailError ? `${id}-email-error` : undefined}
              className="min-w-24 flex-1 bg-transparent py-0.5 outline-none placeholder:text-muted-foreground"
            />
          </div>
          {emailError && (
            <p
              id={`${id}-email-error`}
              role="alert"
              className="text-destructive"
            >
              {emailError}
            </p>
          )}
          <Button
            type="submit"
            disabled={
              busy ||
              !canManage ||
              !onInvite ||
              (!emails.trim() && !recipients.length)
            }
            className="mt-1 ml-auto flex h-[22px] rounded-md bg-[#91d9ac] px-4 text-[10px] font-semibold text-white hover:bg-[#7aca98] disabled:opacity-100"
          >
            Invite
          </Button>
        </div>
      </form>
      {error && (
        <p role="alert" className="mb-2 text-destructive">
          {error}
        </p>
      )}
      <h3 className="mb-1 font-semibold">Admins</h3>
      {managers.map(row)}
      <h3 className="mt-3 mb-1 font-semibold">Members</h3>
      {members.map(row)}
      {!members.length && (
        <p className="text-muted-foreground">No members yet.</p>
      )}
    </div>
  );
}
