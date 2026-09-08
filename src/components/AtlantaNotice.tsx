import { useEffect, useId, useRef, useState } from "react";
import { FiAlertTriangle, FiX } from "react-icons/fi";
import { ATLANTA_NOTICE } from "@/lib/atlantaNotice";
import { useT } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";

function Results({ items }: { items: { label: string; value: string }[] }) {
  return (
    <dl className="overflow-hidden rounded-lg border border-border">
      {items.map(({ label, value }) => (
        <div key={label} className="grid gap-1 border-b border-border px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-6">
          <dt className="font-medium">{label}</dt>
          <dd className="break-words font-mono text-sm sm:text-right">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function AtlantaNotice() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const lang = useAppStore((state) => state.lang);
  const t = useT();
  const content = ATLANTA_NOTICE[lang];

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const trigger = triggerRef.current;

    const body = document.body;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;
    const viewportWidth = document.documentElement.clientWidth;
    const scrollbarWidth = viewportWidth > 0 ? window.innerWidth - viewportWidth : 0;
    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
      trigger?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={t("atlanta_notice_button_aria")}
        title={t("atlanta_notice_button_aria")}
        onClick={() => setOpen(true)}
        className="ml-2 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-amber-500/60 bg-amber-100 text-amber-800 transition duration-150 hover:bg-amber-200 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 dark:bg-amber-950/50 dark:text-amber-300 dark:hover:bg-amber-900/70"
      >
        <FiAlertTriangle aria-hidden="true" className="h-5 w-5" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-3 sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-background-elevated shadow-2xl sm:max-h-[90dvh]"
          >
            <div className="flex shrink-0 items-start gap-3 border-b border-border bg-background-elevated px-5 py-5 sm:px-7">
              <FiAlertTriangle aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-amber-600 dark:text-amber-400" />
              <h2 id={titleId} className="min-w-0 flex-1 text-lg font-semibold sm:text-xl">{content.title}</h2>
              <button
                ref={closeRef}
                type="button"
                aria-label={t("atlanta_notice_close_aria")}
                onClick={() => setOpen(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-foreground-muted transition-colors hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <FiX aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>

            <div className="atlanta-notice-scroll min-h-0 flex-1 space-y-5 overflow-x-hidden overflow-y-auto px-5 py-6 text-sm leading-6 sm:px-7 sm:text-base sm:leading-7">
              <p>
                {content.leadParagraph.before}
                <strong>{content.leadParagraph.title}</strong>
                {content.leadParagraph.between}
                <a
                  href={content.leadParagraph.doiUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {content.leadParagraph.doiUrl}
                </a>
                {content.leadParagraph.after}
              </p>
              {content.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}

              <section className="space-y-3">
                <p>{content.classesIntro}</p>
                <ul className="list-disc space-y-1 pl-6">
                  {content.classes.map(({ label, value }) => (
                    <li key={label}><strong>{label}:</strong> <code>{value}</code></li>
                  ))}
                </ul>
              </section>

              <section className="space-y-3">
                <h3 className="text-base font-semibold sm:text-lg">{content.resultsTitle}</h3>
                <Results items={content.results} />
              </section>

              <section className="space-y-3">
                <p>{content.baselineIntro}</p>
                <Results items={content.baseline} />
              </section>

              <p className="rounded-lg border border-amber-500/40 bg-amber-100/70 p-4 font-medium text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
                {content.versionOfRecord}
              </p>
            </div>
            <div className="flex shrink-0 justify-stretch border-t border-border bg-background-elevated px-5 py-4 sm:justify-end sm:px-7">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full cursor-pointer rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition duration-150 hover:opacity-90 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:w-auto"
              >
                {t("atlanta_notice_acknowledge")}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
