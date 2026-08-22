export function parseLocaleFloat(raw: string | number): number {
  return typeof raw === "number" ? raw : Number(raw.trim().replace(",", "."));
}
