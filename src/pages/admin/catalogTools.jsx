import { useEffect, useRef, useState } from 'react';
import { accountRequest } from '../../api/account';

export function useAdminData(path, revision) {
  const [result, setResult] = useState(null);
  const current = result?.path === path && result.revision === revision ? result : null;
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    accountRequest('/admin' + path, { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) setResult({ path, revision, data });
    }).catch(error => {
      if (!controller.signal.aborted) setResult({ path, revision, error: error.message });
    });
    return () => controller.abort();
  }, [path, revision]);
  return { data: current?.data, error: current?.error, loading: Boolean(path && !current) };
}

export function AdminModal({ title, cancel, busy, children }) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);
  return (
    <dialog ref={dialog} className="admin-dialog card" aria-labelledby="admin-dialog-title" onCancel={event => {
      event.preventDefault();
      if (!busy) cancel();
    }}>
      <h2 id="admin-dialog-title">{title}</h2>
      {children}
    </dialog>
  );
}

export function RequestStatus({ loading, error, retry }) {
  if (loading) return <p role="status">Loading…</p>;
  if (!error) return null;
  return <p role="alert">{error} <button className="btn btn-outline" onClick={retry}>Try Again</button></p>;
}

export function AdminPager({ offset, nextOffset, setOffset }) {
  return (
    <div className="admin-controls">
      <button className="btn btn-outline" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 25))}>Previous</button>
      <span>Page {Math.floor(offset / 25) + 1}</span>
      <button className="btn btn-outline" disabled={nextOffset == null} onClick={() => setOffset(nextOffset)}>Next</button>
    </div>
  );
}

export function StockBadge({ stock }) {
  return (
    <span className={'badge ' + (stock === 0 ? 'badge-danger' : stock <= 5 ? 'badge-warning' : 'badge-success')}>
      {stock === 0 ? 'Out of stock' : stock <= 5 ? 'Low stock · ' + stock : stock}
    </span>
  );
}

export function toPaiseInput(value) {
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(value)) throw new Error('Enter a valid INR amount with up to two decimal places.');
  const [whole, fraction = ''] = value.split('.');
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (amount > 2147483647) throw new Error('The price exceeds the supported range.');
  return amount;
}
