interface LongTaskAttribution {
  name?: string;
  containerType?: string;
  containerName?: string;
}

interface LongTaskEntry extends PerformanceEntry {
  attribution?: LongTaskAttribution[];
}

/**
 * Logs every main-thread task over ~50ms, regardless of where it comes
 * from (React, Leaflet, our own code) — catches blocking work that
 * targeted console.log instrumentation elsewhere in the app might miss.
 */
export function startLongTaskObserver(): void {
  if (typeof PerformanceObserver === "undefined") return;
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as LongTaskEntry[]) {
        const attribution = entry.attribution?.[0];
        console.log(
          `[longtask] start=${entry.startTime.toFixed(1)} duration=${entry.duration.toFixed(1)} ` +
            `name=${attribution?.name ?? "self"} container=${attribution?.containerType ?? "window"}`
        );
      }
    });
    observer.observe({ entryTypes: ["longtask"] });
  } catch {
    // "longtask" entry type not supported in this browser — nothing to do.
  }
}
