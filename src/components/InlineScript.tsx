// Rendering a plain <script> in a Client/Server component triggers a dev
// warning ("scripts inside React components are never executed on the
// client") because it never re-runs on client-side navigation. On a hard
// load it still runs synchronously during HTML parsing, before hydration —
// which is exactly what theme-flash prevention needs. type="text/plain" on
// the client (with suppressHydrationWarning) silences the warning without
// changing that behavior, per Next's preventing-flash-before-hydration guide.
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
