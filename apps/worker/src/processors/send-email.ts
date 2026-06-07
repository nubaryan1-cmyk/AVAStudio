import { jobSchemas, type JobData } from "@avastudio/queue";
import { renderBillingEmail, type BillingEmailTemplate } from "@avastudio/shared/email";

import type { Logger } from "@avastudio/shared";
import type { Job } from "bullmq";

/**
 * Процессор очереди send-email (TASK 19.5). Рендерит шаблон письма и отправляет через
 * порт EmailSender (в проде — Resend). Транспорт вынесен в порт → тестируется без сети.
 */

export interface EmailSender {
  send(input: { to: string; from: string; subject: string; html: string; text: string }): Promise<void>;
}

export interface SendEmailContext {
  sender: EmailSender;
  from: string;
  logger: Logger;
}

const KNOWN = new Set<string>([
  "welcome",
  "payment_succeeded",
  "payment_failed",
  "trial_ending",
  "subscription_cancelled",
  "crypto_invoice_pending",
  "crypto_invoice_expiring",
]);

export function createSendEmailProcessor(ctx: SendEmailContext) {
  return async function sendEmail(job: Job): Promise<{ to: string; template: string }> {
    const data: JobData<"send-email"> = jobSchemas["send-email"].parse(job.data);
    if (!KNOWN.has(data.template)) {
      throw new Error(`send-email: неизвестный шаблон ${data.template}`);
    }
    const rendered = renderBillingEmail(
      data.template as BillingEmailTemplate,
      (data.data ?? {}) as Record<string, string>,
    );
    await ctx.sender.send({
      to: data.to,
      from: ctx.from,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
    ctx.logger.info({ to: data.to, template: data.template }, "billing email sent");
    return { to: data.to, template: data.template };
  };
}
