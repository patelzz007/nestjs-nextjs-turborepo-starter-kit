import { defineConfig } from "@prisma/config"

export default defineConfig({
  earlyAccess: true,
  migrations: {
    seed: "ts-node prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
})
