import React, { FormEvent, useCallback, useEffect, useState } from 'react';
import { canInviteRole, ROLE_LABELS, SUPPORTED_ROLES, StaffRole } from '@kingsfort/shared';
import { RefreshCw, UserPlus } from 'lucide-react';

const API = 'http://127.0.0.1:4310/api';
type StaffMember = {
  id: string; name: string; email: string; role: StaffRole; active: boolean;
  phone: string | null; department: string | null; jobTitle: string | null;
  lastLoginAt: string | null; createdAt: string;
};

export default function StaffPage({ token, currentRole }: { token: string; currentRole: StaffRole }) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<StaffRole>('VIEWER');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const assignableRoles = SUPPORTED_ROLES.filter(candidate => canInviteRole(currentRole, candidate));

  const loadStaff = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(API + '/workspace/users', { headers: { Authorization: 'Bearer ' + token } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to load staff.');
      setStaff(result.users);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load staff.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void loadStaff(); }, [loadStaff]);
  useEffect(() => { if (!assignableRoles.includes(role)) setRole(assignableRoles[0] ?? 'VIEWER'); }, [assignableRoles, role]);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    setInviteToken('');
    try {
      const response = await fetch(API + '/workspace/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ name: name || undefined, email, role }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to create invitation.');
      setInviteToken(result.developmentInviteToken || '');
      setNotice(result.developmentInviteToken
        ? 'Invitation created. Use the development token below to accept it; automatic email delivery is not enabled.'
        : 'Invitation created. Delivery is not configured in this build.');
      setName('');
      setEmail('');
      await loadStaff();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create invitation.');
    } finally {
      setBusy(false);
    }
  }

  return <section className="module-page">
    <div className="module-heading">
      <div><div className="eyebrow">COMPANY OPERATIONS</div><h2>Staff &amp; Roles</h2><p>Review workspace access and invite each person with the role they need.</p></div>
      <button className="secondary refresh-button" onClick={() => void loadStaff()} disabled={loading}><RefreshCw size={15}/> Refresh</button>
    </div>
    {error && <div className="module-alert error" role="alert">{error}</div>}
    {notice && <div className="module-alert success" role="status">{notice}</div>}
    {inviteToken && <div className="invite-token"><strong>Development invite token</strong><code>{inviteToken}</code><small>Anyone holding this token can create the invited account. Share it only with the invited person.</small></div>}
    <div className="module-columns">
      <form className="module-card invite-form" onSubmit={invite}>
        <div className="card-title"><span className="quick-icon"><UserPlus size={19}/></span><div><h3>Invite a teammate</h3><p>Invitation links are one-time and expire after 72 hours.</p></div></div>
        <label>Full name <span className="optional">Optional</span><input value={name} onChange={event => setName(event.target.value)} minLength={2} maxLength={100} placeholder="Staff member's name"/></label>
        <label>Work email<input type="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="name@company.com"/></label>
        <label>Access role<select value={role} onChange={event => setRole(event.target.value as StaffRole)}>{assignableRoles.map(item => <option key={item} value={item}>{ROLE_LABELS[item]}</option>)}</select></label>
        <button className="primary" disabled={busy || assignableRoles.length === 0}>{busy ? 'Creating…' : 'Create invitation'}</button>
      </form>
      <div className="module-card staff-list-card">
        <div className="card-title"><div><h3>Workspace members</h3><p>{staff.length} {staff.length === 1 ? 'person' : 'people'} with an account</p></div></div>
        {loading ? <p className="empty-state">Loading staff…</p> : staff.length === 0 ? <p className="empty-state">No staff accounts were found.</p> :
          <div className="staff-list">{staff.map(member => <article className="staff-row" key={member.id}>
            <div className="staff-avatar">{member.name.slice(0, 1).toUpperCase()}</div>
            <div className="staff-detail"><strong>{member.name}</strong><span>{member.email}</span>{(member.department || member.jobTitle) && <small>{[member.jobTitle, member.department].filter(Boolean).join(' · ')}</small>}</div>
            <div className="staff-meta"><span className="role-pill">{ROLE_LABELS[member.role]}</span><small>{member.active ? 'Active' : 'Inactive'}</small></div>
          </article>)}</div>}
      </div>
    </div>
  </section>;
}
