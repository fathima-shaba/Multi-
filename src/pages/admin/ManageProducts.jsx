import { useState } from 'react';
import { Edit, Trash2, Plus } from 'lucide-react';
import { formatINR } from '../../utils/money';
import { useShop } from '../../context/ShopContext';
import { accountRequest } from '../../api/account';
import { AdminModal, AdminPager, RequestStatus, StockBadge, toPaiseInput, useAdminData } from './catalogTools';

const priceLabel = paise => formatINR(paise / 100);

export default function ManageProducts() {
  const { retryCatalog } = useShop();
  const [filters, setFilters] = useState({ q: '', category: '', status: 'all' });
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState(null);
  const [archive, setArchive] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const categories = useAdminData('/categories', revision);
  const listing = useAdminData('/products?' + new URLSearchParams({ ...filters, offset }), revision);
  const reload = () => setRevision(previous => previous + 1);

  function filter(event) {
    setOffset(0);
    setFilters({ ...filters, [event.target.name]: event.target.value });
  }

  function open(setter, product) {
    setError('');
    setNotice('');
    setter(product);
  }

  async function change(operation, message) {
    setBusy(true);
    setError('');
    try {
      await operation();
      setEditor(null);
      setArchive(null);
      setNotice(message);
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
    const data = Object.fromEntries(new FormData(event.currentTarget));
    change(() => {
      const body = {
        name: data.name, description: data.description, brand: data.brand, categoryId: data.categoryId,
        pricePaise: toPaiseInput(data.price),
        originalPricePaise: data.originalPrice ? toPaiseInput(data.originalPrice) : null,
        images: data.images.split(/\r?\n/).map(url => url.trim()).filter(Boolean),
        active: data.active === 'on',
      };
      if (!editor.id || Number(data.stock) !== editor.stock) {
        body.stock = Number(data.stock);
        if (editor.id) body.stockReason = data.stockReason;
      }
      return accountRequest(editor.id ? '/admin/products/' + editor.id : '/admin/products', {
        method: editor.id ? 'PATCH' : 'POST', body,
      });
    }, editor.id ? 'Product updated.' : 'Product created.');
  }

  return (
    <div className="manage-products">
      <div className="admin-controls admin-heading">
        <h1 className="page-title">Manage Products</h1>
        <button className="btn btn-primary" disabled={!categories.data?.categories.length} onClick={() => open(setEditor, {})}>
          <Plus size={18} /> Add New Product
        </button>
      </div>
      {notice && <p role="status">{notice}</p>}
      <div className="admin-controls">
        <label>Search products<input className="input" name="q" value={filters.q} onChange={filter} maxLength={120} /></label>
        <label>Category<select className="input" name="category" value={filters.category} onChange={filter}>
          <option value="">All categories</option>
          {categories.data?.categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select></label>
        <label>Availability<select className="input" name="status" value={filters.status} onChange={filter}>
          <option value="all">All statuses</option><option value="available">Published</option>
          <option value="unavailable">Unavailable</option><option value="low">Low stock</option><option value="out">Out of stock</option>
        </select></label>
      </div>
      <RequestStatus {...categories} retry={reload} />
      <RequestStatus {...listing} retry={reload} />
      {listing.data && <>
        <div className="card admin-table-wrap">
          <table className="admin-table"><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {listing.data.products.map(product => (
                <tr key={product.id}>
                  <td><div className="admin-product-name">{product.images[0] && <ProductImage src={product.images[0]} alt="" loading="lazy" />}{product.name}</div></td>
                  <td>{product.category}</td><td>{priceLabel(product.pricePaise)}</td>
                  <td><StockBadge stock={product.availableStock ?? product.stock} />{product.reservedStock>0 && <small> · {product.reservedStock} reserved</small>}</td>
                  <td>{!product.active ? 'Archived' : product.categoryActive ? 'Published' : 'Category inactive'}</td>
                  <td><div className="action-buttons">
                    <button className="btn-icon" onClick={() => open(setEditor, product)} title="Edit" aria-label={'Edit ' + product.name}><Edit size={18} /></button>
                    {product.active && <button className="btn-icon delete" onClick={() => open(setArchive, product)} title="Archive" aria-label={'Archive ' + product.name}><Trash2 size={18} /></button>}
                  </div></td>
                </tr>
              ))}
              {!listing.data.products.length && <tr><td colSpan={6}>No matching products.</td></tr>}
            </tbody>
          </table>
        </div>
        <AdminPager offset={offset} nextOffset={listing.data.nextOffset} setOffset={setOffset} />
      </>}
      {editor && <AdminModal title={editor.id ? 'Edit Product' : 'Add New Product'} cancel={() => setEditor(null)} busy={busy}>
        <form onSubmit={save} className="admin-editor">
          <label>Product name<input className="input" name="name" defaultValue={editor.name} maxLength={200} required /></label>
          <label>Description<textarea className="input" name="description" rows={3} defaultValue={editor.description} maxLength={4000} required /></label>
          <label>Brand<input className="input" name="brand" defaultValue={editor.brand || ''} maxLength={100} /></label>
          <label>Category<select name="categoryId" className="input" defaultValue={editor.categoryId} required>
            {editor.categoryId && !categories.data?.categories.some(category => category.id === editor.categoryId) && <option value={editor.categoryId}>{editor.category}</option>}
            {categories.data?.categories.map(category => <option key={category.id} value={category.id}>{category.name}{category.active ? '' : ' (inactive)'}</option>)}
          </select></label>
          <div className="admin-controls">
            <label>Selling price (₹)<input className="input" name="price" inputMode="decimal" type="number" min="0" step="0.01" defaultValue={editor.id ? editor.pricePaise / 100 : ''} required /></label>
            <label>Regular price (₹, optional)<input className="input" name="originalPrice" inputMode="decimal" type="number" min="0" step="0.01" defaultValue={editor.originalPricePaise == null ? '' : editor.originalPricePaise / 100} /></label>
          </div>
          <label>Image URLs, one per line<textarea className="input" name="images" rows={2} defaultValue={editor.images?.join('\n')} /></label>
          <label>On-hand stock<input className="input" name="stock" type="number" min={editor.reservedStock || 0} max="2147483647" step="1" defaultValue={editor.stock ?? 0} required /></label>
          {editor.id && <label>Reason if stock changes<input className="input" name="stockReason" maxLength={250} /></label>}
          <label className="admin-checkbox"><input name="active" type="checkbox" defaultChecked={editor.active ?? true} /> Published</label>
          {error && <p role="alert">{error}</p>}
          <div className="admin-controls">
            <button type="button" className="btn btn-outline" disabled={busy} onClick={() => setEditor(null)}>Cancel</button>
            <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save Product'}</button>
          </div>
        </form>
      </AdminModal>}
      {archive && <AdminModal title="Archive product?" busy={busy} cancel={() => setArchive(null)}>
        <p>{archive.name} will disappear from the storefront. Existing order references will remain.</p>
        {error && <p role="alert">{error}</p>}
        <div className="admin-controls">
          <button className="btn btn-outline" disabled={busy} onClick={() => setArchive(null)}>Cancel</button>
          <button className="btn btn-primary" disabled={busy} onClick={() => change(() => accountRequest('/admin/products/' + archive.id, { method: 'DELETE' }), 'Product archived.')}>Confirm Archive</button>
        </div>
      </AdminModal>}
    </div>
  );
}
