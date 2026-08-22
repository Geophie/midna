export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
      <span
        role="switch"
        aria-checked={checked}
        aria-disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-accent" : "bg-border"
        } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-background-elevated transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </span>
      {label && <span className="text-sm text-foreground">{label}</span>}
    </label>
  );
}
