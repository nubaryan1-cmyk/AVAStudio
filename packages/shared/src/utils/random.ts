/** Рандомизация для anti-ban (человекоподобные задержки/выбор). Не для криптографии. */

/** Случайное целое в [min, max] включительно. */
export function randomInt(min: number, max: number): number {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

/** Случайная задержка в миллисекундах в диапазоне. */
export function randomDelayMs(minMs: number, maxMs: number): number {
  return randomInt(minMs, maxMs);
}

/** Дрожание (jitter): base ± до factor*base. */
export function jitter(baseMs: number, factor = 0.2): number {
  const delta = baseMs * factor;
  return Math.max(0, Math.round(baseMs + (Math.random() * 2 - 1) * delta));
}

/** Случайный элемент непустого массива. */
export function randomChoice<T>(items: readonly T[]): T {
  if (items.length === 0) {
    throw new Error("randomChoice: пустой массив");
  }
  const idx = randomInt(0, items.length - 1);
  return items[idx] as T;
}

/** Перемешивание (Fisher-Yates), возвращает новый массив. */
export function shuffle<T>(items: readonly T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i);
    [arr[i], arr[j]] = [arr[j] as T, arr[i] as T];
  }
  return arr;
}
