/**
 * Out-of-band storage for large binary payloads (DEM file bytes), keyed by
 * layer id. Kept deliberately outside Zustand/React state: React 19 dev-mode
 * ("Performance Tracks") diffs each component's props on every commit for the
 * performance timeline, which enumerates the prop object's properties —
 * including every numeric index of a Uint8Array. For an 80+MB DEM that's
 * ~87 million property accesses, causing multi-second stalls and multi-GB
 * heap growth even though the app's own code never iterates the array that
 * way. Only the actual analysis run needs the real bytes, so they're fetched
 * from here at that point instead of flowing through React as a prop.
 */
const payloads = new Map<string, Uint8Array>();

export function setPayload(key: string, bytes: Uint8Array): void {
  payloads.set(key, bytes);
}

export function getPayload(key: string): Uint8Array {
  return payloads.get(key) ?? new Uint8Array(0);
}

export function hasPayload(key: string): boolean {
  return (payloads.get(key)?.length ?? 0) > 0;
}

export function deletePayload(key: string): void {
  payloads.delete(key);
}
