import type { EpochMs } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { FixedClock } from "../../../../platform/application/__tests__/fixed-clock";
import type { MerchantApiKeyAuthContext } from "../../../../platform/application/ports/api-key-verification.port";
import type { RegisteredTill, TillTerminalsPort } from "../ports/till-terminals.port";
import { TillAuthenticationService } from "../services/till-authentication.service";
import { NOW, TENANT_ID, STORE_A, STORE_B } from "./fakes/pos.fakes";

/** Registered tills by terminal id, recording every `lastSeenAt` touch. */
class InMemoryTills implements TillTerminalsPort {
	public readonly touched: { readonly id: string; readonly at: EpochMs }[] = [];

	public constructor(private readonly tills: ReadonlyMap<string, RegisteredTill>) {}

	public findLive(_tenantId: string, terminalId: string): Promise<RegisteredTill | null> {
		return Promise.resolve(this.tills.get(terminalId) ?? null);
	}

	public touchLastSeen(terminalRowId: string, at: EpochMs): Promise<void> {
		this.touched.push({ id: terminalRowId, at });
		return Promise.resolve();
	}
}

function key(patch: Partial<MerchantApiKeyAuthContext> = {}): MerchantApiKeyAuthContext {
	return {
		provider: "merchant",
		apiKeyId: "key-1",
		tenantId: TENANT_ID,
		locationId: null,
		terminal: null,
		requireRegisteredTerminals: false,
		scope: "POS",
		capabilities: [],
		...patch,
	};
}

const PAIRED = { id: "terminal-row-1", terminalId: "TERM-PAIR2222", locationId: STORE_A };

function service(tills: ReadonlyMap<string, RegisteredTill> = new Map()): { readonly tills: InMemoryTills; readonly service: TillAuthenticationService } {
	const fake = new InMemoryTills(tills);
	return { tills: fake, service: new TillAuthenticationService(fake, new FixedClock(NOW)) };
}

describe("TillAuthenticationService", () => {
	it("treats a paired key as its terminal, at the terminal's store, with or without X-Terminal-Id", async () => {
		const { tills, service: tillService } = service();

		for (const requested of [undefined, PAIRED.terminalId]) {
			await expect(tillService.resolve(key({ terminal: PAIRED }), requested)).resolves.toEqual({
				kind: "resolved",
				point: { tenantId: TENANT_ID, terminalId: PAIRED.terminalId, apiKeyId: "key-1", locationId: STORE_A },
			});
		}
		expect(tills.touched).toEqual([
			{ id: PAIRED.id, at: NOW },
			{ id: PAIRED.id, at: NOW },
		]);
	});

	it("refuses a paired key presented as another terminal", async () => {
		await expect(service().service.resolve(key({ terminal: PAIRED }), "TERM-OTHR2222")).resolves.toEqual({ kind: "refused", refusal: "TERMINAL_KEY_MISMATCH" });
	});

	it("requires X-Terminal-Id for a manually created key", async () => {
		await expect(service().service.resolve(key(), undefined)).resolves.toEqual({ kind: "refused", refusal: "TERMINAL_ID_REQUIRED" });
	});

	it("accepts an unregistered till by default, at an unknown store", async () => {
		const { tills, service: tillService } = service();

		await expect(tillService.resolve(key(), "KL-REGISTER-01")).resolves.toEqual({
			kind: "resolved",
			point: { tenantId: TENANT_ID, terminalId: "KL-REGISTER-01", apiKeyId: "key-1", locationId: null },
		});
		expect(tills.touched).toEqual([]);
	});

	it("refuses an unregistered till when the merchant allows registered terminals only", async () => {
		await expect(service().service.resolve(key({ requireRegisteredTerminals: true }), "KL-REGISTER-01")).resolves.toEqual({
			kind: "refused",
			refusal: "TERMINAL_NOT_REGISTERED",
		});
	});

	it("uses a registered till's store for a tenant-wide key, and touches its lastSeenAt", async () => {
		const { tills, service: tillService } = service(new Map([["KL-REGISTER-01", { id: "row-2", locationId: STORE_B }]]));

		await expect(tillService.resolve(key(), "KL-REGISTER-01")).resolves.toMatchObject({ point: { locationId: STORE_B } });
		expect(tills.touched).toEqual([{ id: "row-2", at: NOW }]);
	});

	it("keeps a store-scoped key's own store, and refuses it on a till registered to another store", async () => {
		const tills = new Map([
			["SAME", { id: "row-a", locationId: STORE_A }],
			["OTHER", { id: "row-b", locationId: STORE_B }],
		]);

		await expect(service(tills).service.resolve(key({ locationId: STORE_A }), "SAME")).resolves.toMatchObject({ point: { locationId: STORE_A } });
		await expect(service(tills).service.resolve(key({ locationId: STORE_A }), "UNREGISTERED")).resolves.toMatchObject({ point: { locationId: STORE_A } });
		await expect(service(tills).service.resolve(key({ locationId: STORE_A }), "OTHER")).resolves.toEqual({ kind: "refused", refusal: "TERMINAL_LOCATION_MISMATCH" });
	});
});
