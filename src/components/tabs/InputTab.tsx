import { Card } from "@/components/ui/Card";
import { UploadPanel } from "@/components/UploadPanel";
import { AnchorPointForm } from "@/components/AnchorPointForm";
import { GridFileForm } from "@/components/GridFileForm";
import { useT } from "@/lib/i18n";

export function InputTab() {
  const t = useT();
  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-3">
        <h2 className="text-base font-medium">{t("input_crimes_card_title")}</h2>
        <UploadPanel />
      </Card>
      <Card className="flex flex-col gap-3">
        <h2 className="text-base font-medium">{t("input_anchor_card_title")}</h2>
        <AnchorPointForm />
      </Card>
      <Card className="flex flex-col gap-3">
        <h2 className="text-base font-medium">{t("input_grid_card_title")}</h2>
        <GridFileForm />
      </Card>
    </div>
  );
}
