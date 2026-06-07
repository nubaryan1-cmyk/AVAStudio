import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    // Миграции идут по ПРЯМОМУ подключению (DATABASE_URL_DIRECT); pooled (DATABASE_URL)
    // не держит DDL-сессии (Supavisor transaction mode). Локально оба совпадают.
    url:
      process.env.DATABASE_URL_DIRECT ??
      process.env.DATABASE_URL ??
      "postgresql://avastudio:avastudio@localhost:5432/avastudio",
  },
});
