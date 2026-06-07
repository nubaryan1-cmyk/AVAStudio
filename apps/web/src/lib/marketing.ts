import { PLANS, type Plan, type PlanId } from "@avastudio/shared/billing";

/**
 * Запрещённые формулировки (риск блокировки эквайера). Контент лендинга проверяется
 * на отсутствие этих слов (см. тест marketing.test.ts).
 */
export const FORBIDDEN_TERMS = ["бот", "накрутк", "масс-постинг", "массpostинг", "массовый постинг"] as const;

export interface Feature {
  title: string;
  description: string;
}

/** Нейтральный, провайдеро-безопасный контент. */
export const HERO = {
  title: "Планировщик публикаций для нескольких аккаунтов",
  subtitle:
    "AVAStudio — платформа управления контентом: храните медиатеку, готовьте варианты роликов и планируйте публикации по расписанию для всех ваших аккаунтов в одном месте.",
  primaryCta: "Начать бесплатно",
  secondaryCta: "Смотреть тарифы",
} as const;

export const FEATURES: Feature[] = [
  {
    title: "Единая медиатека",
    description: "Загружайте и упорядочивайте видео, проверяйте параметры файлов перед публикацией.",
  },
  {
    title: "Подготовка вариантов",
    description: "Создавайте варианты роликов под форматы разных площадок из исходного видео.",
  },
  {
    title: "Планировщик расписания",
    description:
      "Распределяйте публикации по аккаунтам и времени с учётом часовых поясов и дневных лимитов площадок.",
  },
  {
    title: "Несколько площадок",
    description: "Instagram, TikTok, YouTube, Reddit, Threads и X — управление из одного интерфейса.",
  },
  {
    title: "Здоровье аккаунтов",
    description: "Следите за статусом и показателями аккаунтов, получайте подсказки по безопасным лимитам.",
  },
  {
    title: "Командная работа",
    description: "Роли и права доступа для совместной работы над контентом в рамках рабочего пространства.",
  },
];

export const SOCIAL_PROOF = {
  title: "Нам доверяют контент-команды",
  stats: [
    { value: "6", label: "поддерживаемых площадок" },
    { value: "100%", label: "провайдеро-независимая архитектура" },
    { value: "24/7", label: "планирование по расписанию" },
  ],
} as const;

/** Планы для витрины тарифов (по порядку отображения). */
export const PRICING_PLAN_IDS: PlanId[] = ["starter", "pro", "studio", "team", "agency", "enterprise"];

/** Человекочитаемая цена плана для витрины. */
export function formatPlanPrice(plan: Plan): string {
  if (plan.id === "enterprise") return "Индивидуально";
  if (plan.price.amount === "0") return "Бесплатно";
  return `$${plan.price.amount}/мес`;
}

/** Краткий список лимитов плана для карточки. */
export function planHighlights(plan: Plan): string[] {
  const fmt = (v: number | null): string => (v === null ? "Без лимита" : String(v));
  return [
    `Аккаунтов: ${fmt(plan.limits.accounts)}`,
    `Рендеров/мес: ${fmt(plan.limits.renders)}`,
    `Публикаций/мес: ${fmt(plan.limits.posts)}`,
    `Мест в команде: ${fmt(plan.limits.seats)}`,
    plan.features.watermark ? "С водяным знаком" : "Без водяного знака",
  ];
}

export function pricingPlans(): Plan[] {
  return PRICING_PLAN_IDS.map((id) => PLANS[id]);
}
