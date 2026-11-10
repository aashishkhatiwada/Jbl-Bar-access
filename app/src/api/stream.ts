import EventSource from 'react-native-sse';
import type {StreamFactory} from '../engine/controller';

// react-native-sse keeps the whole response text of one XHR, so a stream
// open for hours grows without bound. Recycle the connection quietly every
// RECYCLE_MS; the controller only hears about real failures. Its own
// polling reconnect is disabled: the controller owns reconnect policy.
const RECYCLE_MS = 10 * 60 * 1000;

export const sseStream: StreamFactory = (url, handlers) => {
  let source: EventSource | null = null;
  let closed = false;
  let recycle: ReturnType<typeof setTimeout> | null = null;

  const open = (initial: boolean) => {
    const next = new EventSource(url, {pollingInterval: 0, timeout: 0, timeoutBeforeConnection: 0, lineEndingCharacter: '\n'});
    next.addEventListener('open', () => {
      if (closed || next !== source) return;
      if (initial) handlers.onOpen();
    });
    next.addEventListener('message', event => {
      if (closed || next !== source || !event.data) return;
      handlers.onMessage(event.data);
    });
    next.addEventListener('error', () => {
      if (closed || next !== source) return;
      handlers.onError();
    });
    const previous = source;
    source = next;
    previous?.removeAllEventListeners();
    previous?.close();
    if (recycle) clearTimeout(recycle);
    recycle = setTimeout(() => !closed && open(false), RECYCLE_MS);
  };

  open(true);
  return {
    close() {
      closed = true;
      if (recycle) clearTimeout(recycle);
      source?.removeAllEventListeners();
      source?.close();
      source = null;
    },
  };
};
