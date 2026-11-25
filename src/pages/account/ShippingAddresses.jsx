import { useEffect, useState } from 'react';
import { accountRequest } from '../../api/account';

const fields = [
  ['recipient', 'Recipient', { autoComplete: 'name', minLength: 2, maxLength: 100 }],
  ['phone', 'Phone number', { type: 'tel', autoComplete: 'tel-national', pattern: '[0-9]{10}' }],
  ['addressLine', 'Street address', { autoComplete: 'street-address', minLength: 3, maxLength: 200 }],
  ['locality', 'Locality (optional)', { maxLength: 100, required: false }],
  ['city', 'City', { autoComplete: 'address-level2', minLength: 2, maxLength: 100 }],
  ['state', 'State', { autoComplete: 'address-level1', minLength: 2, maxLength: 100 }],
  ['pincode', 'PIN code', { autoComplete: 'postal-code', inputMode: 'numeric', pattern: '[0-9]{6}' }],
];

export default function ShippingAddresses() {
  const [addresses, setAddresses] = useState(null);
  const [editor, setEditor] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    accountRequest('/addresses', { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) setAddresses(result.addresses);
    }).catch(error => {
      if (!controller.signal.aborted) setLoadError(error.message);
    });
    return () => controller.abort();
  }, [attempt]);

  async function save(event) {
    event.preventDefault();
    const id = editor.id;
    const body = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setNotice(null);
    try {
      const { address } = await accountRequest(id ? '/addresses/' + id : '/addresses', { method: id ? 'PATCH' : 'POST', body });
      setAddresses(previous => id ? previous.map(item => item.id === id ? address : item) : [...previous, address]);
      setEditor(null);
      setNotice({ text: 'Shipping address saved.' });
    } catch (error) {
      setNotice({ text: error.message, error: true });
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    setBusy(true);
    setNotice(null);
    try {
      await accountRequest('/addresses/' + id, { method: 'DELETE' });
      setAddresses(previous => previous.filter(item => item.id !== id));
      setPendingDelete(null);
      setNotice({ text: 'Shipping address removed.' });
    } catch (error) {
      setNotice({ text: error.message, error: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card account-addresses">
      <h3>Shipping addresses</h3>
      {loadError ? (
        <>
          <p role="alert">{loadError}</p>
          <button type="button" className="btn btn-primary" onClick={() => { setLoadError(''); setAttempt(attempt + 1); }}>Try Again</button>
        </>
      ) : !addresses ? <p role="status">Loading shipping addresses…</p> : (
        <>
          <ul className="address-list">
            {addresses.map(address => (
              <li key={address.id} className="order-card">
                <strong>{address.recipient}</strong>
                <p>{[address.addressLine, address.locality, address.city, address.state].filter(Boolean).join(', ')} {address.pincode}</p>
                <p>{address.phone}</p>
                <div className="account-actions">
                  {pendingDelete === address.id ? (
                    <>
                      <button type="button" className="btn btn-outline" disabled={busy} onClick={() => remove(address.id)}>Confirm removal</button>
                      <button type="button" className="btn btn-outline" disabled={busy} onClick={() => setPendingDelete(null)}>Keep Address</button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="btn btn-outline" disabled={busy} onClick={() => { setNotice(null); setEditor(address); }}>Edit Address</button>
                      <button type="button" className="btn btn-outline" disabled={busy} onClick={() => { setEditor(null); setPendingDelete(address.id); }}>Remove Address</button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {!addresses.length && <p>No shipping addresses saved.</p>}
          {editor ? (
            <form key={editor.id || 'new'} aria-label="Shipping address" className="account-form" onSubmit={save}>
              {fields.map(([name, label, attributes]) => (
                <label key={name}>{label}<input name={name} className="input" defaultValue={editor[name] || ''} required {...attributes} /></label>
              ))}
              <div className="account-actions">
                <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save Address'}</button>
                <button className="btn btn-outline" type="button" disabled={busy} onClick={() => setEditor(null)}>Cancel</button>
              </div>
            </form>
          ) : <button type="button" className="btn btn-primary" disabled={busy} onClick={() => { setPendingDelete(null); setNotice(null); setEditor({}); }}>Add Address</button>}
        </>
      )}
      {notice && <p role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
    </section>
  );
}
