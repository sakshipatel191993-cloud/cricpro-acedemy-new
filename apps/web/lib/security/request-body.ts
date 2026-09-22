export class RequestBodyError extends Error {
  constructor(public readonly status: 400 | 413, message: string) { super(message); }
}

/** Bound actual bytes, not just a client-controlled Content-Length header. */
export async function readJsonBody(request: Request, maxBytes = 16_384): Promise<Record<string, unknown>> {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) throw new RequestBodyError(413, 'Request too large');
  const reader = request.body?.getReader();
  if (!reader) throw new RequestBodyError(400, 'Invalid request');
  let bytes = 0;
  const decoder = new TextDecoder();
  let text = '';
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > maxBytes) { await reader.cancel(); throw new RequestBodyError(413, 'Request too large'); }
      text += decoder.decode(part.value, { stream: true });
    }
    text += decoder.decode();
    const data = JSON.parse(text);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Expected object');
    return data;
  } catch (error) {
    if (error instanceof RequestBodyError) throw error;
    throw new RequestBodyError(400, 'Invalid request');
  } finally { reader.releaseLock(); }
}
