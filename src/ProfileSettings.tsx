import React, { useState } from 'react';
import { UserRound } from 'lucide-react';
import { useWorkspace } from './context';
import { mutate } from './api';
import { Panel, Modal, Field } from './components';
export function ProfileSettings({ compact = false }: { compact?: boolean }) {
  const { user, signIn, toast } = useWorkspace(),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [password, setPassword] = useState(false);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = String(new FormData(e.currentTarget).get('name'));
    setBusy(true);
    try {
      signIn(await mutate('/auth/profile', { name }, 'PATCH'));
      toast('Profile updated.');
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function change(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      b = Object.fromEntries(new FormData(form));
    if (b.newPassword !== b.confirmPassword) {
      toast('New passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await mutate('/auth/password', {
        currentPassword: b.currentPassword,
        newPassword: b.newPassword,
      });
      form.reset();
      setPassword(false);
      toast('Password changed; other sessions were signed out.');
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const content = (
    <>
      <form className="stack-form" onSubmit={save}>
        <Field label="Display name">
          <input
            name="name"
            defaultValue={user?.name}
            required
            minLength={2}
            maxLength={80}
            autoComplete="name"
          />
        </Field>
        <Field label="Email">
          <input value={user?.email || ''} readOnly type="email" />
        </Field>
        <p className="fine-print">
          {user?.portal === 'government' ? 'Government Oversight' : user?.company} · {user?.role}.
          Account roles are managed by authorized administrators.
        </p>
        <button className="button primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save profile'}
        </button>
      </form>
      {compact && (
        <>
          <button
            className="button secondary"
            style={{ marginTop: 16 }}
            onClick={() => setPassword(!password)}
          >
            Change password
          </button>
          {password && (
            <form className="stack-form" onSubmit={change}>
              <Field label="Current password">
                <input
                  type="password"
                  name="currentPassword"
                  autoComplete="current-password"
                  required
                  maxLength={128}
                />
              </Field>
              <Field label="New password">
                <input
                  type="password"
                  name="newPassword"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  maxLength={128}
                />
              </Field>
              <Field label="Confirm new password">
                <input
                  type="password"
                  name="confirmPassword"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  maxLength={128}
                />
              </Field>
              <button className="button primary" disabled={busy}>
                Save new password
              </button>
            </form>
          )}
        </>
      )}
    </>
  );
  return compact ? (
    <>
      <button className="icon-button" aria-label="Profile settings" onClick={() => setOpen(true)}>
        <UserRound size={18} />
      </button>
      {open && (
        <Modal title="Profile settings" onClose={() => setOpen(false)}>
          {content}
        </Modal>
      )}
    </>
  ) : (
    <Panel title="My profile">{content}</Panel>
  );
}
