import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@avastudio/ui";
import { getTranslations } from "next-intl/server";

import type { Metadata } from "next";

import { Link } from "@/i18n/navigation";
import { formatPlanPrice, planHighlights, pricingPlans } from "@/lib/marketing";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Marketing.pricingPage");
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function PricingPage(): Promise<JSX.Element> {
  const t = await getTranslations("Marketing.pricingPage");
  const plans = pricingPlans();
  return (
    <div className="mx-auto max-w-6xl px-4 py-20">
      <h1 className="text-center text-4xl font-bold tracking-tight">{t("heading")}</h1>
      <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">{t("subtitle")}</p>
      <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.id} className={plan.id === "pro" ? "border-primary shadow-md" : ""}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{plan.name}</CardTitle>
                <Badge variant={plan.tier === "b2b" ? "secondary" : "outline"}>
                  {plan.tier === "b2b" ? t("tierB2b") : t("tierB2c")}
                </Badge>
              </div>
              <div className="mt-2 text-3xl font-bold">{formatPlanPrice(plan)}</div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {planHighlights(plan).map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
              <Button asChild className="mt-6 w-full" variant={plan.id === "pro" ? "default" : "outline"}>
                <Link href="/signup">
                  {plan.id === "enterprise" ? t("ctaContact") : t("ctaSelect")}
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
