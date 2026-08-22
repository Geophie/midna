const WORKER_SRC = `
self.onmessage = async (e) => {
  try {
    const buffer = await e.data.arrayBuffer();
    self.postMessage(buffer, [buffer]);
  } catch (err) {
    self.postMessage({ __error: String(err) });
  }
};
`;

let workerUrl: string | null = null;

function getWorkerUrl(): string {
  if (!workerUrl) {
    workerUrl = URL.createObjectURL(new Blob([WORKER_SRC], { type: "application/javascript" }));
  }
  return workerUrl;
}

/**
 * Reads a File's bytes off the main thread. A plain Blob worker sidesteps
 * Next.js's unreliable `new Worker(new URL(...))` bundling (see
 * pyodideClient.ts's comment) since there's no module code to bundle at all.
 */
export function readFileBytes(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(getWorkerUrl());
    worker.onmessage = (e: MessageEvent<ArrayBuffer | { __error: string }>) => {
      worker.terminate();
      if (e.data instanceof ArrayBuffer) {
        resolve(new Uint8Array(e.data));
      } else {
        reject(new Error(e.data.__error));
      }
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(e.error ?? new Error("file read failed"));
    };
    worker.postMessage(file);
  });
}
