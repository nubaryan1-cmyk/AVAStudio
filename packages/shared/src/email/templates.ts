/**
 * Транзакционные письма биллинга (TASK 19.5). Чистые рендер-функции (subject+html);
 * отправка — через очередь send-email (процессор воркера, провайдер Resend).
 * Никаких секретов/HTTP здесь — только контент.
 */

export const BILLING_EMAIL_TEMPLATES = [
  "welcome",
  "payment_succeeded",
  "payment_failed",
  "trial_ending",
  "subscription_cancelled",
  "crypto_invoice_pending",
  "crypto_invoice_expiring",
] as const;
export type BillingEmailTemplate = (typeof BILLING_EMAIL_TEMPLATES)[number];

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface EmailData {
  [key: string]: string | number | undefined;
}

function layout(title: string, body: string): string {
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px">
<h1 style="font-size:20px">${title}</h1>${body}
<hr style="border:none;border-top:1px solid #eee;margin:24px 0">
<p style="color:#888;font-size:12px">AVAStudio</p></body></html>`;
}

function esc(v: string | number | undefined): string {
  return String(v ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] ?? c);
}

/** Рендерит письмо по шаблону и данным. Неизвестные ключи игнорируются. */
export function renderBillingEmail(template: BillingEmailTemplate, data: EmailData = {}): RenderedEmail {
  switch (template) {
    case "welcome":
      return {
        subject: "Добро пожаловать в AVAStudio",
        html: layout("Добро пожаловать!", `<p>Аккаунт создан. Тариф: <b>${esc(data.plan ?? "Starter")}</b>.</p>`),
        text: `Добро пожаловать в AVAStudio. Тариф: ${esc(data.plan ?? "Starter")}.`,
      };
    case "payment_succeeded":
      return {
        subject: "Платёж получен — спасибо",
        html: layout("Платёж получен", `<p>Сумма: <b>${esc(data.amount)} ${esc(data.currency)}</b>. Подписка активна.</p>`),
        text: `Платёж получен: ${esc(data.amount)} ${esc(data.currency)}. Подписка активна.`,
      };
    case "payment_failed":
      return {
        subject: "Не удалось списать оплату",
        html: layout("Проблема с оплатой", `<p>Попытка ${esc(data.attempt ?? 1)}. Обновите способ оплаты, чтобы не потерять доступ.</p>`),
        text: `Не удалось списать оплату (попытка ${esc(data.attempt ?? 1)}). Обновите способ оплаты.`,
      };
    case "trial_ending":
      return {
        subject: "Пробный период скоро закончится",
        html: layout("Пробный период заканчивается", `<p>Осталось дней: <b>${esc(data.daysLeft ?? 3)}</b>. Выберите тариф, чтобы продолжить.</p>`),
        text: `Пробный период заканчивается через ${esc(data.daysLeft ?? 3)} дн.`,
      };
    case "subscription_cancelled":
      return {
        subject: "Подписка отменена",
        html: layout("Подписка отменена", `<p>Доступ сохранится до конца оплаченного периода.</p>`),
        text: "Подписка отменена. Доступ — до конца оплаченного периода.",
      };
    case "crypto_invoice_pending":
      return {
        subject: "Ожидаем оплату крипто-инвойса",
        html: layout("Крипто-инвойс создан", `<p>Отправьте <b>${esc(data.amount)} ${esc(data.currency)}</b> на адрес из инвойса. Срок: ${esc(data.expiresAt)}.</p>`),
        text: `Крипто-инвойс: ${esc(data.amount)} ${esc(data.currency)}, срок ${esc(data.expiresAt)}.`,
      };
    case "crypto_invoice_expiring":
      return {
        subject: "Крипто-инвойс скоро истечёт",
        html: layout("Инвойс истекает", `<p>Оплатите в ближайшее время, иначе инвойс закроется.</p>`),
        text: "Крипто-инвойс скоро истечёт — оплатите в ближайшее время.",
      };
  }
}
