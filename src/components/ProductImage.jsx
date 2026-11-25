export default function ProductImage({ src, alt, ...attributes }) {
  function showFallback(event) {
    if (event.currentTarget.getAttribute('src') !== '/favicon.svg') event.currentTarget.src = '/favicon.svg';
  }
  return <img {...attributes} src={src || '/favicon.svg'} alt={alt} onError={showFallback} />;
}
