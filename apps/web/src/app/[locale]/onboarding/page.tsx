"use client";

import { PLANS } from "@avastudio/shared/billing";
import { PLATFORMS } from "@avastudio/shared/domain";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from "@avastudio/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";



import {
  ONBOARDING_STEPS,
  accountSchema,
  buildOnboardingResult,
  planSchema,
  stepProgress,
  workspaceSchema,
  type AccountValues,
  type PlanValues,
  type WorkspaceValues,
} from "@/lib/onboarding";

export default function OnboardingPage(): JSX.Element {
  const t = useTranslations("Onboarding");
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [workspace, setWorkspace] = useState<WorkspaceValues | null>(null);
  const [account, setAccount] = useState<AccountValues | null>(null);

  const workspaceForm = useForm<WorkspaceValues>({
    resolver: zodResolver(workspaceSchema),
    defaultValues: { name: "" },
  });
  const accountForm = useForm<AccountValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: { platform: "instagram", handle: "" },
  });
  const planForm = useForm<PlanValues>({
    resolver: zodResolver(planSchema),
    defaultValues: { planId: "starter" },
  });

  function finish(plan: PlanValues): void {
    if (!workspace) return;
    buildOnboardingResult({ workspace, account, plan });
    router.push("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-lg">
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {t("stepLabel", {
                current: step + 1,
                total: ONBOARDING_STEPS.length,
                title: ONBOARDING_STEPS[step]?.title ?? "",
              })}
            </span>
            <span>{stepProgress(step)}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${stepProgress(step)}%` }}
              role="progressbar"
              aria-valuenow={stepProgress(step)}
            />
          </div>
        </div>

        {step === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>{t("nameWorkspace")}</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...workspaceForm}>
                <form
                  onSubmit={workspaceForm.handleSubmit((v) => {
                    setWorkspace(v);
                    setStep(1);
                  })}
                  className="space-y-4"
                >
                  <FormField
                    control={workspaceForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("name")}</FormLabel>
                        <FormControl>
                          <Input placeholder={t("namePlaceholder")} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full">
                    {t("next")}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        ) : null}

        {step === 1 ? (
          <Card>
            <CardHeader>
              <CardTitle>{t("addAccount")}</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...accountForm}>
                <form
                  onSubmit={accountForm.handleSubmit((v) => {
                    setAccount(v);
                    setStep(2);
                  })}
                  className="space-y-4"
                >
                  <FormField
                    control={accountForm.control}
                    name="platform"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("platform")}</FormLabel>
                        <FormControl>
                          <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                            {...field}
                          >
                            {PLATFORMS.map((p) => (
                              <option key={p} value={p}>
                                {p}
                              </option>
                            ))}
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={accountForm.control}
                    name="handle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("handle")}</FormLabel>
                        <FormControl>
                          <Input placeholder="@brand" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex gap-2">
                    <Button type="submit" className="flex-1">
                      {t("next")}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setAccount(null);
                        setStep(2);
                      }}
                    >
                      {t("skip")}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        ) : null}

        {step === 2 ? (
          <Card>
            <CardHeader>
              <CardTitle>{t("choosePlan")}</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...planForm}>
                <form onSubmit={planForm.handleSubmit(finish)} className="space-y-4">
                  <FormField
                    control={planForm.control}
                    name="planId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("plan")}</FormLabel>
                        <FormControl>
                          <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                            {...field}
                          >
                            {Object.values(PLANS).map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Badge variant="secondary">{t("ownerBadge")}</Badge>
                  <Button type="submit" className="w-full">
                    {t("finish")}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
