/**
 * Prisma `migrate reset` seed hook: apply RLS + app_runtime grants, then seed.
 */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { applyRowLevelSecurity } from "../scripts/apply-rls.ts";

const apiDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

await applyRowLevelSecurity();

const seed = spawnSync("tsx", ["prisma/seed.ts"], {
	cwd: apiDir,
	stdio: "inherit",
	shell: false,
});

if (seed.status !== 0) {
	process.exit(seed.status ?? 1);
}
