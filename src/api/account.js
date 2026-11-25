export async function accountRequest(path, { method = 'GET', body, signal } = {}) {
  const response = await fetch('/api' + path, {
    method, signal, credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(method === 'GET' ? {} : { 'X-MultiStore-Request': '1' }),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 204) return null;
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('The account service is unavailable. Please try again.');
  }
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.error?.message || 'The request could not be completed.');
    error.status = response.status;
    error.code = result.error?.code;
    if (error.code === 'SIGN_IN_REQUIRED') window.dispatchEvent(new Event('multistore:session-ended'));
    throw error;
  }
  return result;
}
