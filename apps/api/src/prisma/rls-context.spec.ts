import { describe, expect, it } from "vitest";

import { MissingTenantContextError } from "./missing-tenant-context.error";
import { currentRlsContext, currentRlsContextOrUnscoped, rlsStorage, runWithSystemRlsContext, systemRlsContext } from "./rls-context";

describe("rls-context", () => {
	it("fails closed outside any scope: no bypass, no user, no organization", () => {
		expect(currentRlsContextOrUnscoped()).toEqual({ userId: "", bypass: false, organizationId: "", requireExplicitContext: false, systemOperation: "" });
		expect(() => currentRlsContext()).toThrow(MissingTenantContextError);
	});

	it("returns the open scope when one exists", () => {
		const scope = { userId: "user-1", bypass: false, organizationId: "org-a", requireExplicitContext: true, systemOperation: "" };

		rlsStorage.run(scope, () => {
			expect(currentRlsContextOrUnscoped()).toBe(scope);
		});
	});

	it("grants bypass only to allowlisted system operations", () => {
		expect(systemRlsContext("queue.job")).toEqual(expect.objectContaining({ bypass: true, systemOperation: "queue.job" }));
		expect(() => systemRlsContext("anything.goes")).toThrow("System operation not allowlisted");
	});

	it("runs background work inside a named system scope", async () => {
		const observed = await runWithSystemRlsContext("scheduled.maintenance", async () => {
			await Promise.resolve();
			return currentRlsContextOrUnscoped();
		});

		expect(observed).toEqual(expect.objectContaining({ bypass: true, systemOperation: "scheduled.maintenance" }));
		expect(currentRlsContextOrUnscoped().bypass).toBe(false);
	});
});
