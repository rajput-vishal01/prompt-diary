import { defineConfig } from "drizzle-kit";
import path from "node:path";

try {
  process.loadEnvFile(path.join(__dirname, "..", ".env"));
} catch {
  // no root .env — fall back to process env / local default below
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // eslint-disable-next-line no-restricted-syntax
    url: process.env.DATABASE_URL ?? "postgres://promptdiary:promptdiary@localhost:5433/promptdiary",
  },
});
