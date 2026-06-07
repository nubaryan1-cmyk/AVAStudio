import { useTranslations } from "next-intl";

/** Страница режима обслуживания (TASK 17.3). Показывается, когда включён флаг maintenanceMode. */
export default function MaintenancePage(): JSX.Element {
  const t = useTranslations("Maintenance");
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-3xl font-bold">{t("title")}</h1>
      <p className="max-w-md text-muted-foreground">{t("subtitle")}</p>
    </main>
  );
}
