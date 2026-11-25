import { useState } from 'react';
import { accountRequest } from '../../api/account';
import { useShop } from '../../context/ShopContext';
import { AdminModal, RequestStatus, useAdminData } from './catalogTools';

export default function ManageCategories() {
  const { retryCatalog } = useShop();
  const [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState(null);
  const [remove, setRemove] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const listing = useAdminData('/categories', revision);
  const reload = () => setRevision(previous => previous + 1);

  function open(setter, value) {
    setNotice('');
    setError('');
    setter(value);
  }

  async function mutate(path, method, body, message) {
    setBusy(true);
    setError('');
    try {
      await accountRequest(path, { method, body });
      setNotice(message);
      setEditor(null);
      setRemove(null);
      reload();
      retryCatalog();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  function save(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    mutate('/admin/categories' + (editor.id ? '/' + editor.id : ''), editor.id ? 'PATCH' : 'POST', {
      name: form.get('name'), description: form.get('description'), active: form.has('active'),
    }, editor.id ? 'Category updated.' : 'Category created.');
  }

  return (
    <section>
      <div className="admin-controls admin-heading">
        <h1 className="page-title">Manage Categories</h1>
        <button className="btn btn-primary" onClick={() => open(setEditor, {})}>Add Category</button>
      </div>
      {notice && <p role="status">{notice}</p>}
      <RequestStatus {...listing} retry={reload} />
      {listing.data && <div className="card admin-table-wrap">
        <table className="admin-table"><thead><tr><th>Category</th><th>Description</th><th>Products</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>{listing.data.categories.map(category => (
            <tr key={category.id}>
              <td>{category.name}</td><td>{category.description || '—'}</td>
              <td>{category.productCount} total · {category.activeProductCount} published</td><td>{category.active ? 'Active' : 'Inactive'}</td>
              <td><div className="action-buttons">
                <button className="btn btn-outline" aria-label={'Edit ' + category.name} onClick={() => open(setEditor, category)}>Edit</button>
                <button className="btn btn-outline" aria-label={'Remove ' + category.name} onClick={() => open(setRemove, category)}>Remove</button>
              </div></td>
            </tr>
          ))}</tbody>
        </table>
      </div>}
      {editor && <AdminModal title={editor.id ? 'Edit Category' : 'Add Category'} cancel={() => setEditor(null)} busy={busy}>
        <form className="admin-editor" onSubmit={save}>
          <label>Category name<input className="input" name="name" maxLength={100} defaultValue={editor.name} required /></label>
          <label>Description<textarea className="input" name="description" maxLength={1000} defaultValue={editor.description} /></label>
          <label className="admin-checkbox"><input type="checkbox" name="active" defaultChecked={editor.active ?? true} /> Active</label>
          {error && <p role="alert">{error}</p>}
          <div className="admin-controls"><button type="button" className="btn btn-outline" disabled={busy} onClick={() => setEditor(null)}>Cancel</button>
            <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save Category'}</button></div>
        </form>
      </AdminModal>}
      {remove && <AdminModal title="Remove category?" cancel={() => setRemove(null)} busy={busy}>
        <p>{remove.name} will be removed from navigation. Archive or reassign its active products first.</p>
        {error && <p role="alert">{error}</p>}
        <div className="admin-controls"><button className="btn btn-outline" disabled={busy} onClick={() => setRemove(null)}>Cancel</button>
          <button className="btn btn-primary" disabled={busy} onClick={() => mutate('/admin/categories/' + remove.id, 'DELETE', undefined, 'Category removed.')}>Confirm Removal</button></div>
      </AdminModal>}
    </section>
  );
}
