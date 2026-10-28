import { STORY_LIMITS } from './story-config.js';
import { assertPlainData } from '../game/cultivation/live/identity.js';

class RequestBodyError extends Error {
  constructor(code, httpStatus = 400) {
    super(code);
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

// Cancellation is cleanup, not another unbounded operation to await. Both a
// stalled read and a rejected body must settle even when the source's cancel
// promise never does; its eventual rejection must not become unhandled.
function cancelBody(body) {
  try { Promise.resolve(body?.cancel()).catch(() => {}); } catch {}
}

export async function readStoryJson(request, { timeoutMs = 10000 } = {}) {
  let reader, timer, onAbort;
  try {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 10000) throw new RequestBodyError('REQUEST_INVALID');
    const deadline = Date.now() + timeoutMs;
    if (request.signal.aborted) throw new RequestBodyError('REQUEST_ABORTED');
    if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get('content-type') ?? '') || request.headers.has('content-encoding')) throw new RequestBodyError('CONTENT_TYPE_INVALID', 415);
    const length = request.headers.get('content-length');
    if (length !== null && (!/^\d+$/.test(length) || Number(length) > STORY_LIMITS.maxRequestBytes)) throw new RequestBodyError('REQUEST_TOO_LARGE', 413);
    if (!request.body) throw new RequestBodyError('REQUEST_INVALID');
    reader = request.body.getReader();

    let interruption, interrupt;
    const interrupted = new Promise(resolve => { interrupt = resolve; });
    function stop(error) {
      if (interruption) return;
      interruption = error;
      interrupt();
    }
    function checkInterrupted() {
      if (request.signal.aborted) stop(new RequestBodyError('REQUEST_ABORTED'));
      if (Date.now() >= deadline) stop(new RequestBodyError('REQUEST_TIMEOUT', 408));
      if (interruption) throw interruption;
    }
    onAbort = () => stop(new RequestBodyError('REQUEST_ABORTED'));
    request.signal.addEventListener('abort', onAbort, { once: true });
    timer = setTimeout(() => stop(new RequestBodyError('REQUEST_TIMEOUT', 408)), Math.max(0, deadline - Date.now()));

    const reading = (async () => {
      const parts = [];
      let size = 0;
      while (true) {
        checkInterrupted();
        const { done, value } = await reader.read();
        checkInterrupted();
        if (done) break;
        if (!(value instanceof Uint8Array)) throw new RequestBodyError('REQUEST_INVALID');
        size += value.byteLength;
        if (size > STORY_LIMITS.maxRequestBytes) throw new RequestBodyError('REQUEST_TOO_LARGE', 413);
        parts.push(value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
      const result = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
      assertPlainData(result);
      checkInterrupted();
      return result;
    })();
    const result = await Promise.race([reading, interrupted]);
    if (interruption) throw interruption;
    return result;
  } catch (error) {
    cancelBody(reader ?? request.body);
    if (error instanceof RequestBodyError) throw error;
    throw new RequestBodyError('REQUEST_INVALID');
  } finally {
    clearTimeout(timer);
    if (onAbort) request.signal.removeEventListener('abort', onAbort);
    reader?.releaseLock();
  }
}
