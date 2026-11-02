#!/usr/bin/env node
/**
 * Writes the throwaway API env a database-backed CI job boots with (see
 * ./lib/api-ci-env.mjs). Used by .github/actions/write-api-ci-env:
 *
 *   node packages/tooling/scripts/write-api-ci-env.mjs --out apps/api/.env \
 *     --database-url <url> --tenancy-mode multi|single [--default-tenant-id <id>]
 *
 * With `--mask-secrets` (the GitHub action passes it) every generated secret is
 * masked in the workflow log before the file is written.
 */
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

import { apiCiEnv, renderEnvFile } from "./lib/api-ci-env.mjs";

/** Owner read/write only: the file holds signing secrets. */
const ENV_FILE_MODE = 0o600;

const { values } = parseArgs({
	options: {
		out: { type: "string" },
		"database-url": { type: "string" },
		"tenancy-mode": { type: "string" },
		"default-tenant-id": { type: "string" },
		"mask-secrets": { type: "boolean", default: false },
	},
	strict: true,
});

const out = values.out ?? "";
const tenancyMode = values["tenancy-mode"];
if (out.length === 0 || (tenancyMode !== "multi" && tenancyMode !== "single")) {
	console.error("usage: write-api-ci-env.mjs --out <file> --database-url <url> --tenancy-mode multi|single [--default-tenant-id <id>] [--mask-secrets]");
	process.exit(1);
}

const defaultTenantId = values["default-tenant-id"];
const { entries, secrets } = apiCiEnv({
	databaseUrl: values["database-url"] ?? "",
	tenancyMode,
	defaultTenantId: defaultTenantId === undefined || defaultTenantId.length === 0 ? undefined : defaultTenantId,
});
if (values["mask-secrets"] === true) {
	for (const secret of secrets) {
		console.log(`::add-mask::${secret}`);
	}
}
writeFileSync(out, renderEnvFile(entries), { mode: ENV_FILE_MODE });
console.log(`wrote ${out} (${String(entries.length)} settings, tenancy ${tenancyMode})`);
