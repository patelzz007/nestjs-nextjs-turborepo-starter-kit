#!/usr/bin/env node
/**
 * Generate the API's locally owned secrets.
 *
 *   pnpm secrets:generate                 print a fresh block for a NEW env file
 *   pnpm secrets:generate apps/api/.env   update an existing env file in place
 *
 * Rotation rules (signing secrets replaced, MFA key ring appended to, tenant
 * master key write-once) live in ./lib/app-secrets.mjs. External credentials
 * (RESEND_API_KEY, RESEND_WEBHOOK_SECRET) are never generated here.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { describeUpdate, formatFreshEnvBlock, generateSecretValues, mergeSecretsIntoEnv } from "./lib/app-secrets.mjs";

function main() {
	const writeTarget = process.argv[2];
	const values = generateSecretValues();

	if (writeTarget === undefined) {
		console.log(formatFreshEnvBlock(values));
		console.log("\n# Paste into a NEW apps/api/.env. To update an existing file (keeps MFA keys): pnpm secrets:generate apps/api/.env");
		return;
	}

	const absolutePath = path.resolve(process.cwd(), writeTarget);
	const result = mergeSecretsIntoEnv(readFileSync(absolutePath, "utf8"), values);
	writeFileSync(absolutePath, result.content, "utf8");
	for (const line of describeUpdate(writeTarget, result)) {
		console.log(line);
	}
}

try {
	main();
} catch (error) {
	console.error(`secrets:generate failed: ${error instanceof Error ? error.message : String(error)}`);
	process.exitCode = 1;
}
