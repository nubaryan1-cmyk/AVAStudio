import type { BillingEmailTemplate } from "./templates.js";
import type { NormalizedPaymentEvent } from "../payments/types.js";

/**
 * Маппинг нормализованного платёжного события (TASK 9.5) → задача send-email (TASK 19.5).
 * Чистая функция; постановку в очередь делает обработчик webhook в инфраструктуре.
 */

export interface EmailJob {
  template: BillingEmailTemplate;
  data: Record<string, string>;
}

/** Возвращает письмо для события или null, если письмо не предусмотрено. */
export function emailForEvent(event: NormalizedPaymentEvent): EmailJob | null {
  switch (event.type) {
    case "subscription_created":
      return { template: "welcome", data: { plan: event.planId ?? "" } };
    case "payment_succeeded":
      return {
        template: "payment_succeeded",
        data: { amount: event.amount?.amount ?? "", currency: event.amount?.currency ?? "" },
      };
    case "payment_failed":
      return { template: "payment_failed", data: { attempt: "1" } };
    case "subscription_cancelled":
      return { template: "subscription_cancelled", data: {} };
    case "subscription_updated":
      return null;
  }
}
