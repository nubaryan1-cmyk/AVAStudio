"use client";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from "@avastudio/ui";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { trpc } from "@/lib/trpc";

export default function DiagnosePage(): JSX.Element {
  const t = useTranslations("Diagnose");
  const params = useParams<{ id: string }>();
  const id = params.id;
  const diag = trpc.billing.diagnose.useQuery({ accountId: id }, { enabled: Boolean(id) });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/accounts">{t("backToAccounts")}</Link>
        </Button>
      </div>

      {diag.isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : !diag.data ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {t("notFound")}
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">{diag.data.handle}</CardTitle>
                  <CardDescription className="capitalize">
                    {diag.data.platform} · health {diag.data.healthScore}
                  </CardDescription>
                </div>
                <Badge variant={diag.data.healthy ? "success" : "warning"}>
                  {diag.data.healthy ? t("noProblems") : t("problemsCount", { count: diag.data.problems.length })}
                </Badge>
              </div>
            </CardHeader>
          </Card>

          {diag.data.healthy ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                {t("allGood")}
              </CardContent>
            </Card>
          ) : (
            diag.data.problems.map((p) => (
              <Card key={p.code}>
                <CardHeader>
                  <CardTitle className="text-base">{p.title}</CardTitle>
                  <CardDescription>{p.explanation}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ol className="list-decimal space-y-1 pl-5 text-sm">
                    {p.steps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            ))
          )}
        </>
      )}
    </div>
  );
}
