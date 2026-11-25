export default function CatalogState({ loading, error, retry, label = 'Loading catalog…' }) {
  if (!loading && !error) return null;
  return (
    <div className="container empty-state">
      {loading ? <p role="status">{label}</p> : (
        <>
          <p role="alert">{error}</p>
          <button className="btn btn-primary" onClick={retry}>Try Again</button>
        </>
      )}
    </div>
  );
}
