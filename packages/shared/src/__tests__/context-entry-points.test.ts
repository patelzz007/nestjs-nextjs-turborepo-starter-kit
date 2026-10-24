import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import * as root from "../index";
import * as auditEntry from "../contexts/audit/index";
import * as authorizationEntry from "../contexts/authorization/index";
import * as catalogEntry from "../contexts/catalog/index";
import * as claimsEntry from "../contexts/claims/index";
import * as filesEntry from "../contexts/files/index";
import * as identityEntry from "../contexts/identity/index";
import * as integrationsGithubEntry from "../contexts/integrations-github/index";
import * as kanbanEntry from "../contexts/kanban/index";
import * as notificationsEntry from "../contexts/notifications/index";
import * as tenancyEntry from "../contexts/tenancy/index";
import * as posEntry from "../contexts/pos/index";
import * as referenceDataEntry from "../contexts/reference-data/index";
import * as referralsEntry from "../contexts/referrals/index";
import * as reportingEntry from "../contexts/reporting/index";
import * as rewardsEntry from "../contexts/rewards/index";

const CONTEXTS_DIR: string = resolve(import.meta.dirname, "..", "contexts");
const PACKAGE_JSON: string = resolve(import.meta.dirname, "..", "..", "package.json");

const contexts: readonly string[] = readdirSync(CONTEXTS_DIR).filter((entry: string): boolean => statSync(join(CONTEXTS_DIR, entry)).isDirectory());

/** Anything a module of this package exports: schemas, functions, constants. */
type ExportedValue = string | number | boolean | bigint | object | null;

/** Every context's entry point, imported statically so each export keeps its type. */
const ENTRIES: Readonly<Record<string, Readonly<Record<string, ExportedValue>>>> = {
	audit: auditEntry,
	authorization: authorizationEntry,
	catalog: catalogEntry,
	claims: claimsEntry,
	files: filesEntry,
	identity: identityEntry,
	"integrations-github": integrationsGithubEntry,
	kanban: kanbanEntry,
	notifications: notificationsEntry,
	tenancy: tenancyEntry,
	pos: posEntry,
	"reference-data": referenceDataEntry,
	referrals: referralsEntry,
	reporting: reportingEntry,
	rewards: rewardsEntry,
};

/** The root barrel's exports by name, for comparing against a context's entry point. */
const rootExports: ReadonlyMap<string, ExportedValue> = new Map<string, ExportedValue>(Object.entries(root));

describe("per-context entry points (@workspace/shared/contexts/<context>)", () => {
	it("gives every context directory an entry, so the `./contexts/*` export never points at a missing file", () => {
		const missing: string[] = contexts.filter((context: string): boolean => !existsSync(join(CONTEXTS_DIR, context, "index.ts")));

		expect(contexts.length).toBeGreaterThan(0);
		expect(missing).toEqual([]);
	});

	it("checks every context directory's entry point below (a new context is added to ENTRIES)", () => {
		expect(Object.keys(ENTRIES).sort()).toEqual([...contexts].sort());
	});

	it("is published as a subpath pattern, in source for development and from the build otherwise, with no import-time side effects", () => {
		const manifest: string = readFileSync(PACKAGE_JSON, "utf8");

		expect(manifest).toContain('"./contexts/*"');
		expect(manifest).toContain('"default": "./src/contexts/*/index.ts"');
		expect(manifest).toContain('"default": "./dist/contexts/*/index.js"');
		expect(manifest).toContain('"sideEffects": false');
	});

	it.each(Object.entries(ENTRIES))(
		"re-exports the %s context's modules: every name the root also exports is the very same value",
		(_context: string, entry: Readonly<Record<string, ExportedValue>>) => {
			const names: string[] = Object.keys(entry);
			const diverging: string[] = names.filter((name: string): boolean => rootExports.has(name) && rootExports.get(name) !== entry[name]);

			expect(names.length).toBeGreaterThan(0);
			expect(diverging).toEqual([]);
		},
	);

	it("carries a context's own contract and route templates, which the root composes into `apiContract` / `apiRoutes`", () => {
		const identity: Readonly<Record<string, ExportedValue>> = identityEntry;

		expect(identity.authContract).toBeDefined();
		expect(identity.authRoutes).toBeDefined();
		expect(rootExports.has("authContract")).toBe(false);
	});
});
