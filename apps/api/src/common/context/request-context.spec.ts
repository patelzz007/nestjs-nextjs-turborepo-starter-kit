import { IncomingMessage } from "node:http";
import { Socket } from "node:net";

import { describe, expect, it } from "vitest";

import { RequestContextService, type RequestContextSeed } from "./request-context";

const SEED: RequestContextSeed = { correlationId: "corr-ctx-1", ip: "203.0.113.7", userAgent: "vitest", edgeLocation: undefined };

describe("RequestContextService", () => {
	const service = new RequestContextService();

	it("is empty outside a request", () => {
		expect(service.current()).toBeUndefined();
		expect(service.correlationId()).toBeUndefined();
		expect(service.logFields()).toBeUndefined();
	});

	it("opens a context with the request-start fields; traceId mirrors the correlation id", () => {
		const before: number = Date.now();
		const opened = service.run(SEED, () => service.current());
		if (opened === undefined) throw new Error("no context opened");
		const { receivedAtEpochMs, ...context } = opened;

		expect(receivedAtEpochMs).toBeGreaterThanOrEqual(before);
		expect(context).toEqual({
			correlationId: "corr-ctx-1",
			traceId: "corr-ctx-1",
			ip: "203.0.113.7",
			userAgent: "vitest",
			edgeLocation: undefined,
			principal: undefined,
			apiKey: undefined,
			tenant: { organizationId: undefined, storeId: undefined, locationId: undefined },
			systemOperations: [],
			isAuditRecorded: false,
		});
	});

	it("marks the audit entry as written in the handler's transaction", () => {
		const marked = service.run(SEED, () => {
			service.markAuditRecorded();
			return service.current()?.isAuditRecorded;
		});

		expect(marked).toBe(true);
	});

	it("records each system operation used by the request once, in first-use order", () => {
		const operations = service.run(SEED, () => {
			service.recordSystemOperation("http.idempotency");
			service.recordSystemOperation("audit.http_request.record");
			service.recordSystemOperation("http.idempotency");
			return service.current()?.systemOperations;
		});

		expect(operations).toEqual(["http.idempotency", "audit.http_request.record"]);
	});

	it("binds the API key that authenticated the request without touching the user principal", () => {
		const context = service.run(SEED, () => {
			service.bindApiKey({ apiKeyId: "key-1", organizationId: "org-1", terminalId: "T-1", locationId: "store-1" });
			return service.current();
		});

		expect(context?.apiKey).toEqual({ apiKeyId: "key-1", organizationId: "org-1", terminalId: "T-1", locationId: "store-1" });
		expect(context?.principal).toBeUndefined();
	});

	it("ignores system-operation and API-key bindings outside a request", () => {
		service.recordSystemOperation("queue.email.send");
		service.bindApiKey({ apiKeyId: "key-1", organizationId: "org-1", terminalId: undefined, locationId: null });

		expect(service.current()).toBeUndefined();
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
				service.bindPrincipal({ userId: "user-a", impersonatorId: undefined, impersonationSessionId: undefined, authMethod: "SESSION_COOKIE" });
				return service.current();
			}),
			service.run({ ...SEED, correlationId: "corr-b" }, async () => {
				service.bindPrincipal({ userId: "user-b", impersonatorId: undefined, impersonationSessionId: undefined, authMethod: "SESSION_COOKIE" });
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
			service.bindPrincipal({ userId: "user-1", impersonatorId: "admin-1", impersonationSessionId: undefined, authMethod: "SESSION_COOKIE" });
			service.bindTenant({ organizationId: "org-1", locationId: "loc-1" });
			return { beforeAuth, afterTenancy: service.current(), log: service.logFields() };
		});

		// Snapshots are immutable: the pre-auth snapshot is unchanged.
		expect(snapshots.beforeAuth?.principal).toBeUndefined();
		expect(snapshots.afterTenancy?.principal).toEqual({ userId: "user-1", impersonatorId: "admin-1", impersonationSessionId: undefined, authMethod: "SESSION_COOKIE" });
		expect(snapshots.afterTenancy?.tenant).toEqual({ organizationId: "org-1", storeId: undefined, locationId: "loc-1" });
		expect(snapshots.log).toEqual({ correlationId: "corr-ctx-1", userId: "user-1", impersonatorId: "admin-1", organizationId: "org-1" });
	});

	it("ignores enrichment outside a request instead of creating a context", () => {
		service.bindPrincipal({ userId: "user-1", impersonatorId: undefined, impersonationSessionId: undefined, authMethod: "SESSION_COOKIE" });
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
