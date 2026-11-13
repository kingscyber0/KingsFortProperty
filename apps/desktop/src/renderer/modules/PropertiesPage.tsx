import React, { FormEvent, useEffect, useState } from 'react';
import { Check, Edit3, Home, Plus, RefreshCw, Search, X } from 'lucide-react';
import { ROLE_PERMISSIONS, StaffRole } from '@kingsfort/shared';

const API = 'http://127.0.0.1:4310/api/workspace';
type Owner = { name: string; phone: string; email?: string | null; isPrimary: boolean };
type Property = { id: string; propertyCode: string; name: string; propertyType: string; location: string; fullAddress: string; transactionType: 'RENT'|'SALE'|'BOTH'; price: string; bedrooms?: number|null; bathrooms?: number|null; furnishingStatus?: string|null; availability: string; approval: string; description?: string|null; owners: Owner[] };
type Props = { token: string; role: StaffRole };
const money = (amount: string) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(amount));
const label = (value: string) => value.toLowerCase().split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

export default function PropertiesPage({ token, role }: Props) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [term, setTerm] = useState('');
  const [approval, setApproval] = useState('');
  const [availability, setAvailability] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState<Property | null>(null);
  const [creating, setCreating] = useState(false);
  const canCreate = ROLE_PERMISSIONS[role].includes('properties:create');
  const canUpdate = ROLE_PERMISSIONS[role].includes('properties:update');
  const canApprove = ROLE_PERMISSIONS[role].includes('properties:approve');

  async function load() {
    setBusy(true); setError('');
    try {
      const params = new URLSearchParams();
      if (term.trim()) params.set('q', term.trim());
      if (approval) params.set('approval', approval);
      if (availability) params.set('availability', availability);
      const response = await fetch(API + '/properties?' + params, { headers: { Authorization: 'Bearer ' + token } });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Properties could not be loaded.');
      setProperties(body.properties);
    } catch (e) { setError(e instanceof Error ? e.message : 'Properties could not be loaded.'); }
    finally { setBusy(false); }
  }
  useEffect(() => { void load(); }, [token, approval, availability]);

  async function changeStatus(property: Property, action: string, body: object, message: string) {
    setError(''); setNotice('');
    try {
      const response = await fetch(API + '/properties/' + encodeURIComponent(property.id) + '/' + action, { method: 'PATCH', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'The property could not be updated.');
      setNotice(message); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'The property could not be updated.'); }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setNotice('');
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const owner = { name: String(data.ownerName || '').trim(), phone: String(data.ownerPhone || '').trim(), email: String(data.ownerEmail || '').trim(), isPrimary: true };
    const payload = { name: data.name, propertyType: data.propertyType, location: data.location, fullAddress: data.fullAddress, transactionType: data.transactionType, price: Number(data.price), bedrooms: data.bedrooms === '' ? null : Number(data.bedrooms), bathrooms: data.bathrooms === '' ? null : Number(data.bathrooms), furnishingStatus: data.furnishingStatus || null, description: data.description || null, owners: owner.name && owner.phone ? [owner] : [] };
    setBusy(true);
    try {
      const response = await fetch(API + '/properties' + (editing ? '/' + encodeURIComponent(editing.id) : ''), { method: editing ? 'PATCH' : 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Property could not be saved.');
      setCreating(false); setEditing(null); setNotice(editing ? 'Property details saved.' : 'Property registered and submitted for approval.'); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Property could not be saved.'); }
    finally { setBusy(false); }
  }

  const form = creating || editing;
  return <div className="properties-page">
    <div className="page-title properties-title"><div><div className="eyebrow">PROPERTY MANAGEMENT</div><h1>Properties</h1><p>Register listings, update availability and review approval status for this company.</p></div>{canCreate && <button className="primary properties-add" onClick={() => { setEditing(null); setCreating(true); setError(''); }}><Plus size={17}/> Register property</button>}</div>
    <div className="properties-toolbar"><form className="property-search" onSubmit={event => { event.preventDefault(); void load(); }}><Search size={17}/><input value={term} onChange={event => setTerm(event.target.value)} placeholder="Search code, property, area or address"/><button type="submit">Search</button></form><select aria-label="Filter approval" value={approval} onChange={event => setApproval(event.target.value)}><option value="">All approval statuses</option>{['PENDING','APPROVED','REJECTED','CHANGES_REQUESTED','DRAFT'].map(value => <option key={value} value={value}>{label(value)}</option>)}</select><select aria-label="Filter availability" value={availability} onChange={event => setAvailability(event.target.value)}><option value="">All availability</option>{['AVAILABLE','RESERVED','RENTED','SOLD','UNAVAILABLE'].map(value => <option key={value} value={value}>{label(value)}</option>)}</select><button className="property-refresh" onClick={() => void load()} aria-label="Refresh"><RefreshCw size={16}/></button></div>
    {error && <div className="property-alert error">{error}</div>}{notice && <div className="property-alert success">{notice}</div>}
    <div className="property-summary"><span>{properties.length} {properties.length === 1 ? 'property' : 'properties'}</span><span><i className="status-dot"/> Company workspace records</span></div>
    {busy && !properties.length ? <div className="property-empty">Loading properties…</div> : properties.length === 0 ? <div className="property-empty"><span className="property-empty-icon"><Home size={24}/></span><h3>No properties found</h3><p>{term || approval || availability ? 'Try changing your search or filters.' : 'Register your company’s first property to track its details and availability.'}</p>{canCreate && !term && !approval && !availability && <button className="primary" onClick={() => setCreating(true)}><Plus size={16}/> Register property</button>}</div> : <div className="property-table-wrap"><table className="property-table"><thead><tr><th>PROPERTY</th><th>TYPE & LOCATION</th><th>PRICE</th><th>AVAILABILITY</th><th>APPROVAL</th><th>OWNER</th><th></th></tr></thead><tbody>{properties.map(property => <tr key={property.id}><td><strong>{property.name}</strong><small>{property.propertyCode} · {label(property.transactionType)}</small></td><td><strong>{property.propertyType}</strong><small>{property.location}</small></td><td><strong>{money(property.price)}</strong><small>{property.bedrooms ? property.bedrooms + ' bed' : 'Bedrooms not set'}{property.bathrooms ? ' · ' + property.bathrooms + ' bath' : ''}</small></td><td>{canUpdate ? <select className="status-select" aria-label={'Availability for ' + property.name} value={property.availability} onChange={event => void changeStatus(property, 'availability', { availability: event.target.value }, 'Availability updated.')}>{['AVAILABLE','RESERVED','RENTED','SOLD','UNAVAILABLE'].map(value => <option key={value} value={value}>{label(value)}</option>)}</select> : <span className={'status-pill ' + property.availability.toLowerCase()}>{label(property.availability)}</span>}</td><td><span className={'status-pill ' + property.approval.toLowerCase()}>{label(property.approval)}</span>{canApprove && property.approval !== 'APPROVED' && <button className="property-approve" onClick={() => void changeStatus(property, 'approval', { approval: 'APPROVED' }, 'Property approved.')}>Approve</button>}</td><td>{property.owners?.[0]?.name || 'Not assigned'}<small>{property.owners?.[0]?.phone || 'Owner details pending'}</small></td><td>{canUpdate && <button className="property-icon-button" aria-label={'Edit ' + property.name} onClick={() => { setCreating(false); setEditing(property); setError(''); }}><Edit3 size={16}/></button>}</td></tr>)}</tbody></table></div>}
    {form && <div className="modal-backdrop"><section className="property-modal"><div className="property-modal-head"><div><div className="eyebrow">{editing ? 'EDIT LISTING' : 'NEW LISTING'}</div><h2>{editing ? 'Update property' : 'Register a property'}</h2><p>New properties start as pending manager review.</p></div><button className="property-icon-button" aria-label="Close" onClick={() => { setCreating(false); setEditing(null); setError(''); }}><X size={19}/></button></div><form className="property-form" onSubmit={save}><div className="property-form-grid"><label>Property name<input name="name" required minLength={2} maxLength={140} defaultValue={editing?.name}/></label><label>Type<input name="propertyType" required minLength={2} maxLength={80} placeholder="Apartment, duplex, land…" defaultValue={editing?.propertyType}/></label><label>Area or city<input name="location" required minLength={2} maxLength={120} defaultValue={editing?.location}/></label><label>Transaction<select name="transactionType" defaultValue={editing?.transactionType || 'RENT'}><option value="RENT">For rent</option><option value="SALE">For sale</option><option value="BOTH">Rent or sale</option></select></label><label>Price (NGN)<input name="price" type="number" min="1" step="0.01" required defaultValue={editing?.price}/></label><label>Furnishing<select name="furnishingStatus" defaultValue={editing?.furnishingStatus || ''}><option value="">Not specified</option><option>Furnished</option><option>Part furnished</option><option>Unfurnished</option></select></label><label>Bedrooms<input name="bedrooms" type="number" min="0" max="100" defaultValue={editing?.bedrooms ?? ''}/></label><label>Bathrooms<input name="bathrooms" type="number" min="0" max="100" defaultValue={editing?.bathrooms ?? ''}/></label><label className="property-address">Full address<textarea name="fullAddress" required minLength={5} maxLength={300} rows={2} defaultValue={editing?.fullAddress}/></label><label className="property-address">Description<textarea name="description" maxLength={3000} rows={3} defaultValue={editing?.description || ''}/></label><div className="property-owner-heading">OWNER DETAILS <span>Optional</span></div><label>Owner name<input name="ownerName" defaultValue={editing?.owners?.[0]?.name}/></label><label>Owner phone<input name="ownerPhone" defaultValue={editing?.owners?.[0]?.phone}/></label><label>Owner email<input name="ownerEmail" type="email" defaultValue={editing?.owners?.[0]?.email || ''}/></label></div>{error && <div className="property-alert error">{error}</div>}<div className="property-form-actions"><button type="button" className="secondary" onClick={() => { setCreating(false); setEditing(null); }}>Cancel</button><button className="primary" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Register property'} <Check size={16}/></button></div></form></section></div>}
  </div>;
}
