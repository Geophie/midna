import { Card } from "@/components/ui/Card";
import { ParamsForm } from "@/components/ParamsForm";
import { useT } from "@/lib/i18n";

export function ParametriTab() {
  const t = useT();
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-base font-medium">{t("tab_params")}</h2>
      <ParamsForm />
    </Card>
  );
}
