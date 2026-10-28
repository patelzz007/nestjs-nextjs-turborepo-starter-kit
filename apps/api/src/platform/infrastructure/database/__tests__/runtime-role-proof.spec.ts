import { describe, expect, it } from "vitest";

import {
	APPLICATION_TABLES,
	evaluateRuntimeRoleProof,
	RuntimeRoleProof,
	RuntimeRoleProofError,
	type RuntimeRoleFactsReader,
	type RuntimeRoleProofFacts,
	type TableRlsFacts,
} from "../runtime-role-proof";

const FORCED: TableRlsFacts = { table: "Reward", exists: true, rlsEnabled: true, rlsForced: true };

function facts(overrides: Partial<RuntimeRoleProofFacts> = {}): RuntimeRoleProofFacts {
	return {
		role: { role: "app_runtime", exists: true, isSuperuser: false, bypassesRls: false },
		tables: [FORCED],
		...overrides,
	};
}

/** A catalog double that answers with fixed facts. */
function catalogOf(answer: RuntimeRoleProofFacts): RuntimeRoleFactsReader {
	return { read: (): Promise<RuntimeRoleProofFacts> => Promise.resolve(answer) };
}

describe("evaluateRuntimeRoleProof", () => {
	it("passes when the runtime role cannot bypass RLS and every table forces it", () => {
		expect(evaluateRuntimeRoleProof(facts())).toEqual([]);
	});

	it("DB-006: names a runtime role that is a superuser, bypasses RLS, or is missing", () => {
		expect(evaluateRuntimeRoleProof(facts({ role: { role: "app_runtime", exists: true, isSuperuser: true, bypassesRls: true } }))).toEqual([
			{ subject: "role app_runtime", problem: "is SUPERUSER, which ignores every RLS policy" },
			{ subject: "role app_runtime", problem: "has BYPASSRLS, which ignores every RLS policy" },
		]);
		expect(evaluateRuntimeRoleProof(facts({ role: { role: "app_runtime", exists: false, isSuperuser: false, bypassesRls: false } }))).toEqual([
			{ subject: "role app_runtime", problem: "does not exist (run pnpm tools db:apply-security)" },
		]);
	});

	it("DB-006: names every table that does not enable or force RLS, or does not exist", () => {
		const tables: TableRlsFacts[] = [
			FORCED,
			{ table: "Location", exists: true, rlsEnabled: true, rlsForced: false },
			{ table: "Tenant", exists: true, rlsEnabled: false, rlsForced: false },
			{ table: "Membership", exists: false, rlsEnabled: false, rlsForced: false },
		];

		expect(evaluateRuntimeRoleProof(facts({ tables }))).toEqual([
			{ subject: "table Location", problem: "does not FORCE ROW LEVEL SECURITY, so its owner bypasses every policy" },
			{ subject: "table Tenant", problem: "does not ENABLE ROW LEVEL SECURITY" },
			{ subject: "table Tenant", problem: "does not FORCE ROW LEVEL SECURITY, so its owner bypasses every policy" },
			{ subject: "table Membership", problem: "does not exist (migrations not applied)" },
		]);
	});

	it("checks every Prisma model's table", () => {
		expect(APPLICATION_TABLES).toContain("Tenant");
		expect(APPLICATION_TABLES).toContain("RewardSale");
		expect(new Set(APPLICATION_TABLES).size).toBe(APPLICATION_TABLES.length);
	});
});

describe("RuntimeRoleProof", () => {
	it("lets boot continue and reports healthy when isolation holds", async () => {
		const proof = new RuntimeRoleProof(catalogOf(facts()));

		await expect(proof.onModuleInit()).resolves.toBeUndefined();
		await expect(proof.isHealthy()).resolves.toBe(true);
		await expect(proof.getReport()).resolves.toEqual({ role: "app_runtime", tables: APPLICATION_TABLES.length, failures: 0 });
	});

	it("refuses to boot, and fails readiness, when the runtime role can bypass RLS", async () => {
		const proof = new RuntimeRoleProof(catalogOf(facts({ role: { role: "app_runtime", exists: true, isSuperuser: false, bypassesRls: true } })));

		await expect(proof.onModuleInit()).rejects.toBeInstanceOf(RuntimeRoleProofError);
		await expect(proof.onModuleInit()).rejects.toThrow("role app_runtime has BYPASSRLS");
		await expect(proof.isHealthy()).resolves.toBe(false);
	});
});
