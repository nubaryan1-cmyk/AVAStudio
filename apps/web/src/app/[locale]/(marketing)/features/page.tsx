import { Card, CardContent, CardHeader, CardTitle } from "@avastudio/ui";
import { getTranslations } from "next-intl/server";

import type { Metadata } from "next";

import { FEATURES } from "@/lib/marketing";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Marketing.featuresPage");
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function FeaturesPage(): Promise<JSX.Element> {
  const t = await getTranslations("Marketing.featuresPage");
  return (
    <div className="mx-auto max-w-6xl px-4 py-20">
      <h1 className="text-center text-4xl font-bold tracking-tight">{t("heading")}</h1>
      <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">{t("subtitle")}</p>
      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <Card key={f.title}>
            <CardHeader>
              <CardTitle>{f.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">{f.description}</CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
