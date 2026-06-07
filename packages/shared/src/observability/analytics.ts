/**
 * Продуктовая аналитика (TASK 24.4, PostHog). Провайдеро-независимый слой: события +
 * порт capture + consent-gating. Трекинг включается ТОЛЬКО после согласия (cookie consent);
 * секреты/PII в свойствах не передаём.
 */
export const ANALYTICS_EVENTS = [
  "signup",
  "onboarding_complete",
  "account_added",
  "media_uploaded",
  "render_started",
  "render_completed",
  "post_scheduled",
  "post_published",
  "subscription_started",
] as const;
export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

export interface AnalyticsSink {
  capture(input: { event: AnalyticsEvent; distinctId: string; properties?: Record<string, string | number | boolean> }): void;
  identify(distinctId: string, traits?: Record<string, string | number | boolean>): void;
}

export interface AnalyticsOptions {
  /** Согласие пользователя на трекинг (cookie consent). Без него — no-op. */
  consent: boolean;
  sink: AnalyticsSink;
}

/** Трекер с consent-gating: без согласия ничего не отправляет. */
export class Analytics {
  constructor(private readonly opts: AnalyticsOptions) {}
  track(event: AnalyticsEvent, distinctId: string, properties?: Record<string, string | number | boolean>): void {
    if (!this.opts.consent) return;
    this.opts.sink.capture(properties ? { event, distinctId, properties } : { event, distinctId });
  }
  identify(distinctId: string, traits?: Record<string, string | number | boolean>): void {
    if (!this.opts.consent) return;
    this.opts.sink.identify(distinctId, traits);
  }
}
