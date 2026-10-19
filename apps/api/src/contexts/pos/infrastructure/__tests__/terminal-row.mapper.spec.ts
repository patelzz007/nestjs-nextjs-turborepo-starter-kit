import { epochMs } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { terminalStatusWhere, toTerminalSummary, type TerminalSummaryRow } from "../persistence/terminal-row.mapper";
import { LIVE_ROW_FIELDS } from "../../../../platform/infrastructure/persistence/__tests__/base-row-fields";

const NOW = epochMs(1_792_195_200_000);

function row(patch: Partial<TerminalSummaryRow> = {}): TerminalSummaryRow {
	return {
		...LIVE_ROW_FIELDS,
		id: "terminal-1",
		organizationId: "org-1",
		locationId: "store-a",
		terminalId: "TERM-AAAA2222",
		label: null,
		apiKeyId: null,
		createdByUserId: "member-1",
		pairingCodeHash: null,
		pairingCodeExpiresAt: null,
		pairingCodeIssuedByUserId: null,
		pairingCodeIssuedAt: null,
		pairedAt: null,
		lastSeenAt: null,
		isDeleted: false,
		deletedAt: null,
		deletedBy: null,
		createdAt: BigInt(NOW),
		updatedAt: BigInt(NOW),
		location: { name: "Store A" },
		apiKey: null,
		...patch,
	};
}

describe("toTerminalSummary", () => {
	it("names an unlabelled till by its terminal id and shows its store", () => {
		expect(toTerminalSummary(row(), NOW)).toMatchObject({ name: "TERM-AAAA2222", locationName: "Store A", status: "UNPAIRED", pairingCodeExpiresAt: null });
		expect(toTerminalSummary(row({ label: "Front till" }), NOW).name).toBe("Front till");
	});

	it("shows the code's expiry only while it is awaiting pairing", () => {
		const awaiting = row({ pairingCodeHash: "hash", pairingCodeExpiresAt: BigInt(NOW + 1) });
		expect(toTerminalSummary(awaiting, NOW)).toMatchObject({ status: "AWAITING_PAIRING", pairingCodeExpiresAt: NOW + 1 });
		expect(toTerminalSummary({ ...awaiting, pairingCodeExpiresAt: BigInt(NOW - 1) }, NOW)).toMatchObject({ status: "UNPAIRED", pairingCodeExpiresAt: null });
	});

	it("is active with an unrevoked key, unpaired once the key is revoked", () => {
		const paired = row({ pairedAt: BigInt(NOW), apiKeyId: "key-1", apiKey: { revokedAt: null }, lastSeenAt: BigInt(NOW) });
		expect(toTerminalSummary(paired, NOW)).toMatchObject({ status: "ACTIVE", pairedAt: NOW, lastSeenAt: NOW });
		expect(toTerminalSummary({ ...paired, apiKey: { revokedAt: BigInt(NOW) } }, NOW).status).toBe("UNPAIRED");
	});
});

describe("terminalStatusWhere", () => {
	it("filters awaiting tills by a live code, and active ones by no live code, a pairing and an unrevoked key", () => {
		expect(terminalStatusWhere("AWAITING_PAIRING", NOW)).toEqual({ pairingCodeHash: { not: null }, pairingCodeExpiresAt: { gte: NOW } });
		expect(terminalStatusWhere("ACTIVE", NOW)).toEqual({
			AND: [
				{ OR: [{ pairingCodeHash: null }, { pairingCodeExpiresAt: null }, { pairingCodeExpiresAt: { lt: NOW } }] },
				{ pairedAt: { not: null } },
				{ apiKey: { is: { revokedAt: null } } },
			],
		});
	});
});
