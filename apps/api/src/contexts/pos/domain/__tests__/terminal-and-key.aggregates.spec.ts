import { epochMs } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { TenantApiKey } from "../aggregates/tenant-api-key.aggregate";
import { TenantTerminal, type IssuedPairingCode, type TenantTerminalState } from "../aggregates/tenant-terminal.aggregate";
import { API_KEY_SCOPE_CAPABILITIES } from "../policies/api-key-scope.policy";
import { NOW, TENANT_ID, STORE_A } from "./pos-domain.fixture";

const CODE: IssuedPairingCode = { hash: "code-hash", expiresAt: epochMs(NOW + 1), issuedByUserId: "member-1", issuedAt: NOW };

function loaded(patch: Partial<TenantTerminalState> = {}): TenantTerminal {
	return TenantTerminal.rehydrate({
		id: "terminal-1",
		tenantId: TENANT_ID,
		locationId: STORE_A,
		terminalId: "TERM-AAAA2222",
		label: "Front till",
		apiKeyId: null,
		pairingCode: null,
		pairedAt: null,
		...patch,
	});
}

describe("TenantTerminal", () => {
	it("registers with its first code, issued by the registering member", () => {
		const terminal = TenantTerminal.register({
			id: "terminal-1",
			tenantId: TENANT_ID,
			locationId: STORE_A,
			terminalId: "TERM-AAAA2222",
			name: "Front till",
			createdByUserId: "member-1",
			pairingCode: CODE,
		});

		expect(terminal.registrant).toBe("member-1");
		expect(terminal.snapshot()).toMatchObject({ apiKeyId: null, pairedAt: null, pairingCode: CODE });
		expect(terminal.pendingChange).toBeNull();
	});

	it("knows no registrant once loaded, and shows its terminal id when it has no label", () => {
		expect(loaded().registrant).toBeNull();
		expect(loaded({ label: null }).displayName).toBe("TERM-AAAA2222");
		expect(loaded().displayName).toBe("Front till");
	});

	it("replaces its live code", () => {
		const terminal = loaded({ pairingCode: { ...CODE, hash: "old" } });
		terminal.issuePairingCode(CODE);

		expect(terminal.snapshot().pairingCode).toEqual(CODE);
		expect(terminal.pendingChange).toEqual({ kind: "pairing_code_issued", code: CODE });
	});

	it("is removed with its code cleared, handing back the key to revoke", () => {
		const terminal = loaded({ apiKeyId: "key-1", pairingCode: CODE });

		expect(terminal.remove("member-2", NOW)).toBe("key-1");
		expect(terminal.snapshot().pairingCode).toBeNull();
		expect(terminal.pendingChange).toEqual({ kind: "removed", removedByUserId: "member-2", removedAt: NOW });
		expect(loaded().remove("member-2", NOW)).toBeNull();
	});

	it("pairs with a new key, handing back the key it replaces", () => {
		const terminal = loaded({ apiKeyId: "old-key", pairingCode: CODE });

		expect(terminal.consumedCodeIssuer()).toBe("member-1");
		expect(terminal.pairWith("new-key", NOW)).toBe("old-key");
		expect(terminal.snapshot()).toMatchObject({ apiKeyId: "new-key", pairedAt: NOW, pairingCode: null });
		expect(terminal.pendingChange).toEqual({ kind: "paired", apiKeyId: "new-key", pairedAt: NOW });
	});

	it("names no issuer for a code issued before issuer tracking, or no code at all", () => {
		expect(loaded({ pairingCode: { ...CODE, issuedByUserId: null, issuedAt: null } }).consumedCodeIssuer()).toBeNull();
		expect(loaded().consumedCodeIssuer()).toBeNull();
	});
});

describe("TenantApiKey.revoke (D34)", () => {
	it("revokes a live key once", () => {
		const key = TenantApiKey.rehydrate({ id: "key-1", tenantId: TENANT_ID, locationId: null, revokedAt: null });

		expect(key.revoke(NOW)).toBe(true);
		expect(key.revokedInThisUnitOfWork).toBe(NOW);
		expect(key.revoke(epochMs(NOW + 1))).toBe(false);
		expect(key.revokedInThisUnitOfWork).toBe(NOW);
	});

	it("leaves an already revoked key as it is", () => {
		const key = TenantApiKey.rehydrate({ id: "key-1", tenantId: TENANT_ID, locationId: STORE_A, revokedAt: epochMs(NOW - 1) });

		expect(key.revoke(NOW)).toBe(false);
		expect(key.revokedInThisUnitOfWork).toBeNull();
		expect(key.locationId).toBe(STORE_A);
	});
});

describe("API_KEY_SCOPE_CAPABILITIES", () => {
	it("gives a till key nothing on the tenant API and an integration key read + manage rewards only", () => {
		expect(API_KEY_SCOPE_CAPABILITIES.POS).toEqual([]);
		expect(API_KEY_SCOPE_CAPABILITIES.INTEGRATION).toEqual(["merchant:view_rewards", "merchant:manage_rewards", "merchant:view_redemptions", "merchant:view_analytics"]);
	});
});
