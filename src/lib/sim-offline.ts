/** Simulated-offline flag for demoing offline drafts (Account screen toggle). */
type Listener = (v: boolean) => void;

let simOffline = false;
const listeners = new Set<Listener>();

export function setSimOffline(v: boolean) {
  simOffline = v;
  listeners.forEach((l) => l(v));
}

export function isSimOffline(): boolean {
  return simOffline;
}

export function onSimOfflineChange(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
