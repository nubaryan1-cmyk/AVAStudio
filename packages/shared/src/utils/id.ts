import { v7 as uuidv7 } from "uuid";

/** Сортируемый по времени идентификатор (UUID v7). */
export const newId = (): string => uuidv7();
