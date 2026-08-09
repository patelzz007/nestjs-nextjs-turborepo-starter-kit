// ── E2E env bootstrap ─────────────────────────────────────────────────────
// Vitest loads `setupFiles` BEFORE any test-file imports are evaluated, so
// these defaults are guaranteed to be set before the AppModule dependency
// graph (TypedConfigService, PrismaService, ConfigModule) reads them.
// Only `DATABASE_URL` pointing at a reachable Postgres is strictly required:
//
//   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/hello_world \
//   pnpm --filter @workspace/api test:e2e
process.env.NODE_ENV ??= "test";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/hello_world";
process.env.JWT_ACCESS_SECRET ??= "e2e-access-secret";
process.env.JWT_ACCESS_EXPIRY ??= "15m";
process.env.JWT_REFRESH_SECRET ??= "e2e-refresh-secret";
process.env.JWT_REFRESH_EXPIRY ??= "7d";
process.env.EMAIL_VERIFICATION_SECRET ??= "e2e-email-secret";
process.env.BCRYPT_SALT_ROUNDS ??= "10";
process.env.RESEND_API_KEY ??= "re_dummy";
process.env.EMAIL_FROM_ADDRESS ??= "noreply@example.com";
process.env.APP_NAME ??= "hello-world";
process.env.APP_URL ??= "http://localhost:3000";
process.env.CORS_ORIGINS ??= "http://localhost:3000,http://localhost:3001";
