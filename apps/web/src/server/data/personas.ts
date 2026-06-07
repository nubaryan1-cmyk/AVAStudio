/**
 * AI-Персоны (Фаза 1) — профили генерации контента: тон, ниша, язык, шаблон промпта.
 * In-memory CRUD (Фаза 2 — Postgres). Персона задаёт стиль для AI-Генерации/подписей.
 */

export const PERSONA_TONES = ["expert", "friendly", "bold", "ironic", "inspirational"] as const;
export type PersonaTone = (typeof PERSONA_TONES)[number];

export interface Persona {
  id: string;
  name: string;
  niche: string;
  tone: PersonaTone;
  language: string;
  promptTemplate: string;
  createdAt: string;
}

export interface CreatePersonaInput {
  name: string;
  niche: string;
  tone: PersonaTone;
  language: string;
  promptTemplate: string;
}

let seq = 0;
const STORE = new Map<string, Persona>();

function seed(): void {
  if (STORE.size > 0) return;
  const presets: CreatePersonaInput[] = [
    {
      name: "Фитнес-коуч",
      niche: "фитнес и здоровье",
      tone: "inspirational",
      language: "ru",
      promptTemplate: "Короткое мотивирующее видео о {тема}. Энергично, с призывом к действию.",
    },
    {
      name: "Tech-обзорщик",
      niche: "гаджеты и технологии",
      tone: "expert",
      language: "ru",
      promptTemplate: "Чёткий разбор {тема}: плюсы, минусы, вывод за 30 секунд.",
    },
  ];
  for (const p of presets) void insert(p, "2026-05-29T10:00:00Z");
}

function insert(input: CreatePersonaInput, createdAt: string): Persona {
  const id = `persona_${(seq += 1)}`;
  const rec: Persona = { id, ...input, createdAt };
  STORE.set(id, rec);
  return rec;
}

export function listPersonas(): Persona[] {
  seed();
  return [...STORE.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function createPersona(input: CreatePersonaInput): Persona {
  seed();
  return insert(input, new Date().toISOString());
}

export function updatePersona(id: string, input: CreatePersonaInput): Persona {
  seed();
  const existing = STORE.get(id);
  if (!existing) throw new Error("Персона не найдена");
  const updated: Persona = { ...existing, ...input };
  STORE.set(id, updated);
  return updated;
}

export function deletePersona(id: string): { id: string } {
  seed();
  if (!STORE.delete(id)) throw new Error("Персона не найдена");
  return { id };
}
