import { describe, expect, it } from "vitest";

import {
  enrollTotp,
  generateBackupCodes,
  generateTotpToken,
  verifyBackupCode,
  verifyTotp,
} from "./totp.js";
import { decrypt, generateDataKey } from "../credentials/index.js";

describe("TOTP 2FA (TASK 10.2)", () => {
  it("enroll выдаёт QR + зашифрованный секрет; verify валидным кодом проходит", async () => {
    const dek = generateDataKey();
    const enrollment = await enrollTotp({ accountName: "user@avastudio.app", dek });
    expect(enrollment.qrCodeDataUrl.startsWith("data:image/png;base64,")).toBe(true);
    expect(enrollment.otpauthUrl.startsWith("otpauth://totp/")).toBe(true);

    // секрет реально зашифрован (восстановим из URL и сверим с дешифровкой)
    const secret = new URL(enrollment.otpauthUrl).searchParams.get("secret")!;
    expect(decrypt(enrollment.secretEncrypted, dek)).toBe(secret);

    const token = generateTotpToken(secret);
    expect(verifyTotp(token, enrollment.secretEncrypted, dek)).toBe(true);
  });

  it("verify неверным кодом не проходит", async () => {
    const dek = generateDataKey();
    const enrollment = await enrollTotp({ accountName: "u@a.app", dek });
    expect(verifyTotp("000000", enrollment.secretEncrypted, dek)).toBe(false);
  });

  it("секрет НЕ хранится в открытом виде в блобе", async () => {
    const dek = generateDataKey();
    const enrollment = await enrollTotp({ accountName: "u@a.app", dek });
    const secret = new URL(enrollment.otpauthUrl).searchParams.get("secret")!;
    expect(JSON.stringify(enrollment.secretEncrypted)).not.toContain(secret);
  });

  it("backup-коды генерируются (10, хешированные) и одноразовы", async () => {
    const { codes, hashes } = await generateBackupCodes();
    expect(codes).toHaveLength(10);
    expect(hashes).toHaveLength(10);
    expect(hashes[0]).toMatch(/^\$2[aby]\$/);
    expect(hashes.join()).not.toContain(codes[0]!);

    const first = await verifyBackupCode(codes[0]!, hashes);
    expect(first.ok).toBe(true);
    expect(first.remainingHashes).toHaveLength(9);

    // повторное использование того же кода уже невозможно
    const reuse = await verifyBackupCode(codes[0]!, first.remainingHashes);
    expect(reuse.ok).toBe(false);
  });

  it("неверный backup-код отклоняется без расхода", async () => {
    const { hashes } = await generateBackupCodes(3);
    const res = await verifyBackupCode("99999-99999", hashes);
    expect(res.ok).toBe(false);
    expect(res.remainingHashes).toHaveLength(3);
  });
});
