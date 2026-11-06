#!/usr/bin/env node
/**
 * Generate the API's locally owned secrets.
 *
 *   pnpm tools secrets:generate                 print a fresh block for a NEW env file
 *   pnpm tools secrets:generate apps/api/.env   update an existing env file in place
 *
 * Rotation rules (signing secrets replaced, MFA key ring appended to, tenant
 * master key write-once) live in app-secrets.ts. External credentials
 * (RESEND_API_KEY, RESEND_WEBHOOK_SECRET) are never generated here.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { describeUpdate, formatFreshEnvBlock, generateSecretValues, mergeSecretsIntoEnv } from "./app-secrets.ts";

function main(): void {
	const writeTarget = process.argv.at(2);
	const values = generateSecretValues();

	if (writeTarget === undefined) {
		process.stdout.write(`${formatFreshEnvBlock(values)}\n`);
		process.stdout.write("\n# Paste into a NEW apps/api/.env. To update an existing file (keeps MFA keys): pnpm tools secrets:generate apps/api/.env\n");
		return;
	}

	const absolutePath = path.resolve(process.cwd(), writeTarget);
	const result = mergeSecretsIntoEnv(readFileSync(absolutePath, "utf8"), values);
	writeFileSync(absolutePath, result.content, "utf8");
	for (const line of describeUpdate(writeTarget, result)) {
		process.stdout.write(`${line}\n`);
	}
}

try {
	main();
} catch (error) {
	process.stderr.write(`secrets:generate failed: ${error instanceof Error ? error.message : String(error)}\n`);
	process.exitCode = 1;
}
