/**
 * Конфигурация крипто-провайдера из env (TASK 19.2). Поддерживаемые монеты и порог
 * подтверждений приходят из Doppler; ядро/драйвер их только используют.
 */

export interface CryptoConfig {
  /** Тикеры поддерживаемых монет, напр. ["BTC","USDT","ETH"]. */
  coins: string[];
  /** Минимум подтверждений сети для зачёта оплаты. */
  confirmations: number;
}

export interface CryptoEnvSource {
  CRYPTO_SUPPORTED_COINS?: string | undefined;
  CRYPTO_CONFIRMATIONS?: string | undefined;
}

const DEFAULT_COINS = ["BTC", "USDT", "ETH"];

export function buildCryptoConfig(env: CryptoEnvSource): CryptoConfig {
  const coins = (env.CRYPTO_SUPPORTED_COINS ?? "")
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter((c) => c !== "");
  const confirmations = Number(env.CRYPTO_CONFIRMATIONS ?? "2");
  return {
    coins: coins.length > 0 ? coins : DEFAULT_COINS,
    confirmations: Number.isFinite(confirmations) && confirmations > 0 ? confirmations : 2,
  };
}
