import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // eslint-disable-next-line no-restricted-syntax
    url: process.env.DATABASE_URL ?? "postgres://promptdiary:promptdiary@localhost:5432/promptdiary",
  },
});
