import { randomUUID } from 'node:crypto';

export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function requestLog(request, response, next) {
  const id = randomUUID();
  const start = performance.now();
  response.setHeader('X-Request-Id', id);
  response.locals.requestId = id;
  response.on('finish', () => console.log(JSON.stringify({
    id, method: request.method, route: request.route?.path ?? '(unmatched)',
    status: response.statusCode, durationMs: Math.round(performance.now() - start),
  })));
  next();
}

export function errorHandler(error, _request, response, next) {
  if (response.headersSent) return next(error);
  const requestId = response.locals.requestId;
  if (error instanceof HttpError) {
    return response.status(error.status).json({ error: { code: error.code, message: error.message, requestId } });
  }

  if (error instanceof URIError || error.type === 'entity.parse.failed') {
    return response.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Malformed request.', requestId } });
  }

  if (error.type === 'entity.too.large') {
    return response.status(413).json({ error: { code: 'REQUEST_TOO_LARGE', message: 'Request body exceeds the size limit.', requestId } });
  }

  console.error('Request failed', requestId, error.code ?? error.name);
  return response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'The request could not be completed.', requestId } });
}
