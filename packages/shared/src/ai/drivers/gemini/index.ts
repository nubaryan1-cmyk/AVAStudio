/**
 * Gemini (Vertex AI) текстовый драйвер (TASK 20.3, опционально). Для текста/сценариев/
 * анализа. Существующая AI-абстракция (ЭТАП 11) покрывает image/video/audio/music и НЕ
 * меняется — текст добавляется отдельным аддитивным контрактом TextProvider + fallback.
 * Реальный вызов вынесен в структурный порт GeminiPort → тестируется без сети.
 */

export interface TextRequest {
  prompt: string;
  /** Макс. токенов ответа (подсказка модели). */
  maxOutputTokens?: number;
  /** Системная инструкция/роль. */
  system?: string;
}

export interface TextUsage {
  inputChars: number;
  outputChars: number;
}

export interface TextResult {
  text: string;
  provider: string;
  model: string;
  usage: TextUsage;
}

export interface TextProvider {
  readonly name: string;
  generateText(req: TextRequest): Promise<TextResult>;
}

/** Структурный порт Gemini (в проде — @google/genai / Vertex SDK). */
export interface GeminiPort {
  generate(input: { prompt: string; system?: string; maxOutputTokens?: number }): Promise<{ text: string }>;
}

export interface GeminiOptions {
  client: GeminiPort;
  model?: string;
}

const GEMINI_USD_PER_1K_CHARS = 0.0005;

/** Оценка стоимости текстового вызова (USD, десятичная строка, 6 знаков). */
export function estimateGeminiCost(usage: TextUsage): string {
  const chars = usage.inputChars + usage.outputChars;
  const total = (chars / 1000) * GEMINI_USD_PER_1K_CHARS;
  return (Math.round(total * 1e6) / 1e6).toFixed(6);
}

export class GeminiTextProvider implements TextProvider {
  readonly name = "gemini";
  private readonly client: GeminiPort;
  private readonly model: string;

  constructor(options: GeminiOptions) {
    this.client = options.client;
    this.model = options.model ?? "gemini-1.5-flash";
  }

  async generateText(req: TextRequest): Promise<TextResult> {
    if (req.prompt.trim() === "") throw new Error("gemini: пустой prompt");
    const out = await this.client.generate({
      prompt: req.prompt,
      ...(req.system ? { system: req.system } : {}),
      ...(req.maxOutputTokens ? { maxOutputTokens: req.maxOutputTokens } : {}),
    });
    return {
      text: out.text,
      provider: this.name,
      model: this.model,
      usage: { inputChars: req.prompt.length, outputChars: out.text.length },
    };
  }
}

/** Прогон по цепочке текстовых провайдеров до первого успеха (fallback, как ЭТАП 11.1). */
export async function generateTextWithFallback(
  providers: readonly TextProvider[],
  req: TextRequest,
): Promise<TextResult> {
  const errors: string[] = [];
  for (const p of providers) {
    try {
      return await p.generateText(req);
    } catch (err) {
      errors.push(`${p.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw new Error(`Все текстовые провайдеры недоступны: ${errors.join("; ")}`);
}
