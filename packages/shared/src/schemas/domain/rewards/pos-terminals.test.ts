import { describe, expect, it } from "vitest";

import {
	MerchantCreateTerminalSchema,
	MerchantTerminalListQuerySchema,
	MerchantTerminalSettingsSchema,
	POS_TERMINAL_NAME_MAX_LENGTH,
	PosPairTerminalSchema,
} from "./rewards-entities";

const LOCATION_ID = "4d9a3f5e-2f6b-4c55-8f0c-9a4b1c2d3e4f";

describe("MerchantCreateTerminalSchema", () => {
	it("trims the name and requires a store", () => {
		expect(MerchantCreateTerminalSchema.parse({ name: "  Front counter  ", locationId: LOCATION_ID })).toEqual({ name: "Front counter", locationId: LOCATION_ID });
		expect(MerchantCreateTerminalSchema.safeParse({ name: "Front counter" }).success).toBe(false);
	});

	it("rejects blank or over-long names and unknown fields", () => {
		expect(MerchantCreateTerminalSchema.safeParse({ name: "   ", locationId: LOCATION_ID }).success).toBe(false);
		expect(MerchantCreateTerminalSchema.safeParse({ name: "x".repeat(POS_TERMINAL_NAME_MAX_LENGTH + 1), locationId: LOCATION_ID }).success).toBe(false);
		expect(MerchantCreateTerminalSchema.safeParse({ name: "Till", locationId: LOCATION_ID, terminalId: "MY-ID" }).success).toBe(false);
	});
});

describe("PosPairTerminalSchema", () => {
	it("accepts an 8-character code from the unambiguous alphabet only", () => {
		expect(PosPairTerminalSchema.safeParse({ pairingCode: "ABCD2345" }).success).toBe(true);
		expect(PosPairTerminalSchema.safeParse({ pairingCode: "ABCD234" }).success).toBe(false);
		expect(PosPairTerminalSchema.safeParse({ pairingCode: "ABCD234O" }).success).toBe(false);
	});
});

describe("terminal list and settings", () => {
	it("narrows the list to one store only through locationId", () => {
		expect(MerchantTerminalListQuerySchema.parse({ locationId: LOCATION_ID }).locationId).toBe(LOCATION_ID);
		expect(MerchantTerminalListQuerySchema.safeParse({ locationId: "nope" }).success).toBe(false);
	});

	it("requires an explicit boolean for the registered-terminals policy", () => {
		expect(MerchantTerminalSettingsSchema.safeParse({ requireRegisteredTerminals: true }).success).toBe(true);
		expect(MerchantTerminalSettingsSchema.safeParse({}).success).toBe(false);
	});
});
