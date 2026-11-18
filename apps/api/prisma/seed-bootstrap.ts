/**
 * Prisma `migrate reset` seed hook: apply RLS + app_runtime grants, then seed.
 */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";

import { apiEnvFilePath } from "../scripts/lib/env-file.js";
import { applyRowLevelSecurity } from "./security/apply.js";

const apiDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Prisma runs this hook as its own process: load the API's env (apps/api/.env, or DOTENV_PATH) before the typed
// config is first read (on the apply below, never at import), exactly as prisma.config.ts does. Variables already
// set (CI's env) win.
loadEnv({ path: apiEnvFilePath(apiDir), quiet: true });

await applyRowLevelSecurity();

const seed = spawnSync("tsx", ["prisma/seed.ts"], {
	cwd: apiDir,
	stdio: "inherit",
	shell: false,
});

if (seed.status !== 0) {
	process.exit(seed.status ?? 1);
}
