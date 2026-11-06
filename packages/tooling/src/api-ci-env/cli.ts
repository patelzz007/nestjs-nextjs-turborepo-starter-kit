#!/usr/bin/env node
/**
 * Writes the throwaway API env a database-backed CI job boots with (see
 * api-ci-env.ts). Used by .github/actions/write-api-ci-env:
 *
 *   node packages/tooling/src/api-ci-env/cli.ts --out apps/api/.env \
 *     --database-url <url> --tenancy-mode multi|single [--default-tenant-id <id>]
 *
 * With `--mask-secrets` (the GitHub action passes it) every generated secret is
 * masked in the workflow log before the file is written.
 */
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

import { apiCiEnv, renderEnvFile } from "./api-ci-env.ts";

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
	process.stderr.write("usage: src/api-ci-env/cli.ts --out <file> --database-url <url> --tenancy-mode multi|single [--default-tenant-id <id>] [--mask-secrets]\n");
	process.exit(1);
}

const defaultTenantId = values["default-tenant-id"];
const { entries, secrets } = apiCiEnv({
	databaseUrl: values["database-url"] ?? "",
	tenancyMode,
	defaultTenantId: defaultTenantId === undefined || defaultTenantId.length === 0 ? undefined : defaultTenantId,
});
if (values["mask-secrets"]) {
	for (const secret of secrets) {
		process.stdout.write(`::add-mask::${secret}\n`);
	}
}
writeFileSync(out, renderEnvFile(entries), { mode: ENV_FILE_MODE });
process.stdout.write(`wrote ${out} (${String(entries.length)} settings, tenancy ${tenancyMode})\n`);
