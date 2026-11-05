import React, { FormEvent, useCallback, useEffect, useState } from 'react';
import { Check, RefreshCw, Save } from 'lucide-react';

const API = 'http://127.0.0.1:4310/api';
type CompanyProfile = {
  id: string; name: string; email: string; phone: string | null; address: string | null;
  timezone: string; currency: string; logoUrl: string | null;
};

export default function CompanySettingsPage({ token, canEdit }: { token: string; canEdit: boolean }) {
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', timezone: 'Africa/Lagos', currency: 'NGN' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const loadCompany = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(API + '/workspace/company', { headers: { Authorization: 'Bearer ' + token } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to load company settings.');
      setCompany(result.company);
      setForm({
        name: result.company.name ?? '',
        email: result.company.email ?? '',
        phone: result.company.phone ?? '',
        address: result.company.address ?? '',
        timezone: result.company.timezone ?? 'Africa/Lagos',
        currency: result.company.currency ?? 'NGN',
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load company settings.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void loadCompany(); }, [loadCompany]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const response = await fetch(API + '/workspace/company', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone || null,
          address: form.address || null,
          timezone: form.timezone,
          currency: form.currency,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save company settings.');
      setCompany(result.company);
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save company settings.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <section className="module-page"><p className="empty-state">Loading company settings…</p></section>;
  return <section className="module-page">
    <div className="module-heading">
      <div><div className="eyebrow">COMPANY OPERATIONS</div><h2>Company Settings</h2><p>Manage the workspace profile and the defaults used for local dates and amounts.</p></div>
      <button className="secondary refresh-button" onClick={() => void loadCompany()} disabled={loading}><RefreshCw size={15}/> Refresh</button>
    </div>
    {error && <div className="module-alert error" role="alert">{error}</div>}
    {saved && <div className="module-alert success" role="status"><Check size={16}/> Company settings saved.</div>}
    {!canEdit && <div className="module-alert info">Only a Company Administrator can change these settings. You can still review the current profile.</div>}
    <form className="module-card settings-form" onSubmit={save}>
      <div className="card-title"><div><h3>Workspace profile</h3><p>Changes are recorded in the company audit log.</p></div></div>
      <div className="settings-grid">
        <label>Company name<input required minLength={2} maxLength={120} value={form.name} disabled={!canEdit} onChange={event => setForm({ ...form, name: event.target.value })}/></label>
        <label>Company email<input type="email" required value={form.email} disabled={!canEdit} onChange={event => setForm({ ...form, email: event.target.value })}/></label>
        <label>Phone number<input maxLength={30} value={form.phone} disabled={!canEdit} onChange={event => setForm({ ...form, phone: event.target.value })} placeholder="Optional"/></label>
        <label>Currency code<input required minLength={3} maxLength={3} value={form.currency} disabled={!canEdit} onChange={event => setForm({ ...form, currency: event.target.value.toUpperCase() })}/><small>Use a three-letter currency code, such as NGN.</small></label>
        <label className="wide-field">Office address<input maxLength={250} value={form.address} disabled={!canEdit} onChange={event => setForm({ ...form, address: event.target.value })} placeholder="Optional"/></label>
        <label>Time zone<input required maxLength={64} value={form.timezone} disabled={!canEdit} onChange={event => setForm({ ...form, timezone: event.target.value })}/><small>Use an IANA time zone, such as Africa/Lagos.</small></label>
      </div>
      {canEdit && <button className="primary save-settings" disabled={saving || !company}><Save size={16}/>{saving ? 'Saving…' : 'Save settings'}</button>}
    </form>
  </section>;
}
