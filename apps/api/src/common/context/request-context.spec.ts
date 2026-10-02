import { IncomingMessage } from "node:http";
import { Socket } from "node:net";

import { describe, expect, it } from "vitest";

import { RequestContextService, type RequestContextSeed } from "./request-context";

const SEED: RequestContextSeed = { correlationId: "corr-ctx-1", ip: "203.0.113.7", userAgent: "vitest" };

describe("RequestContextService", () => {
	const service = new RequestContextService();

	it("is empty outside a request", () => {
		expect(service.current()).toBeUndefined();
		expect(service.correlationId()).toBeUndefined();
		expect(service.logFields()).toBeUndefined();
	});

	it("opens a context with the request-start fields; traceId mirrors the correlation id", () => {
		const context = service.run(SEED, () => service.current());

		expect(context).toEqual({
			correlationId: "corr-ctx-1",
			traceId: "corr-ctx-1",
			ip: "203.0.113.7",
			userAgent: "vitest",
			principal: undefined,
			tenant: { organizationId: undefined, storeId: undefined, locationId: undefined },
		});
	});

	it("survives awaits and is visible to every instance (the store is process-wide)", async () => {
		const other = new RequestContextService();
		const observed = await service.run(SEED, async () => {
			await Promise.resolve();
			await new Promise<void>((resolve): void => {
				setTimeout(resolve, 1);
			});
			return other.correlationId();
		});

		expect(observed).toBe("corr-ctx-1");
	});

	it("keeps concurrent requests isolated", async () => {
		const [first, second] = await Promise.all([
			service.run({ ...SEED, correlationId: "corr-a" }, async () => {
				await new Promise<void>((resolve): void => {
					setTimeout(resolve, 2);
				});
				service.bindPrincipal({ userId: "user-a", impersonatorId: undefined });
				return service.current();
			}),
			service.run({ ...SEED, correlationId: "corr-b" }, async () => {
				service.bindPrincipal({ userId: "user-b", impersonatorId: undefined });
				await Promise.resolve();
				return service.current();
			}),
		]);

		expect([first?.correlationId, first?.principal?.userId]).toEqual(["corr-a", "user-a"]);
		expect([second?.correlationId, second?.principal?.userId]).toEqual(["corr-b", "user-b"]);
	});

	it("publishes the principal and verified tenant to everything that runs afterwards in the request", () => {
		const snapshots = service.run(SEED, () => {
			const beforeAuth = service.current();
			service.bindPrincipal({ userId: "user-1", impersonatorId: "admin-1" });
			service.bindTenant({ organizationId: "org-1", locationId: "loc-1" });
			return { beforeAuth, afterTenancy: service.current(), log: service.logFields() };
		});

		// Snapshots are immutable: the pre-auth snapshot is unchanged.
		expect(snapshots.beforeAuth?.principal).toBeUndefined();
		expect(snapshots.afterTenancy?.principal).toEqual({ userId: "user-1", impersonatorId: "admin-1" });
		expect(snapshots.afterTenancy?.tenant).toEqual({ organizationId: "org-1", storeId: undefined, locationId: "loc-1" });
		expect(snapshots.log).toEqual({ correlationId: "corr-ctx-1", userId: "user-1", impersonatorId: "admin-1", organizationId: "org-1" });
	});

	it("ignores enrichment outside a request instead of creating a context", () => {
		service.bindPrincipal({ userId: "user-1", impersonatorId: undefined });
		service.bindTenant({ organizationId: "org-1" });

		expect(service.current()).toBeUndefined();
	});

	it("resolves the correlation id from the context first, else from the raw request memo", () => {
		const raw = new IncomingMessage(new Socket());
		raw.headers = { "x-correlation-id": "corr-header" };

		expect(service.run(SEED, () => service.resolveCorrelationId(raw))).toBe("corr-ctx-1");
		expect(service.resolveCorrelationId(raw)).toBe("corr-header");
	});
});
