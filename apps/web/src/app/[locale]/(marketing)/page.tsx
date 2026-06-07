import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@avastudio/ui";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { FEATURES, HERO, SOCIAL_PROOF } from "@/lib/marketing";

function JsonLd(): JSX.Element {
  const data = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "AVAStudio",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: HERO.subtitle,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export default function HomePage(): JSX.Element {
  const t = useTranslations("Marketing");
  return (
    <>
      <JsonLd />
      <section className="mx-auto max-w-6xl px-4 py-24 text-center">
        <Badge variant="secondary" className="mb-4">
          {t("badge")}
        </Badge>
        <h1 className="mx-auto max-w-3xl text-balance text-4xl font-bold tracking-tight sm:text-5xl">
          {HERO.title}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">{HERO.subtitle}</p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Button asChild size="lg">
            <Link href="/signup">{HERO.primaryCta}</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/pricing">{HERO.secondaryCta}</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="mb-10 text-center text-3xl font-bold">{t("featuresHeading")}</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <Card key={f.title}>
              <CardHeader>
                <CardTitle>{f.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground">{f.description}</CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-t bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center">
          <h2 className="mb-10 text-2xl font-semibold">{SOCIAL_PROOF.title}</h2>
          <div className="grid gap-8 sm:grid-cols-3">
            {SOCIAL_PROOF.stats.map((s) => (
              <div key={s.label}>
                <div className="text-4xl font-bold text-primary">{s.value}</div>
                <div className="mt-2 text-sm text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 text-center">
        <h2 className="text-3xl font-bold">{t("ctaHeading")}</h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">{t("ctaSubtitle")}</p>
        <Button asChild size="lg" className="mt-8">
          <Link href="/signup">{HERO.primaryCta}</Link>
        </Button>
      </section>
    </>
  );
}
