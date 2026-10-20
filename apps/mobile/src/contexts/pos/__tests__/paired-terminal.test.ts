import type { PosPairedTerminal } from "@workspace/shared";

import { SECURE_STORE_ENTRIES } from "../../../lib/secure-store";
import { memorySecureStore } from "../../../../test/secure-store-memory";
import { forgetPairedTerminal, pairedTerminalOf, readPairedTerminal, savePairedTerminal, type PairedTerminal } from "../paired-terminal";

const PAIRED: PosPairedTerminal = {
	apiKey: "mk_live_abc123",
	terminalId: "TERM-7F3K9QX2",
	terminalName: "Front counter",
	organization: { slug: "kopi-co", displayName: "Kopi & Co" },
	location: { id: "5b1f2c4e-8a3d-4e6f-9b7a-1c2d3e4f5a6b", name: "KLCC" },
};

const TERMINAL: PairedTerminal = pairedTerminalOf(PAIRED);

describe("pairedTerminalOf", () => {
	it("keeps the key, the terminal id and the names the till screen shows", () => {
		expect(TERMINAL).toEqual({
			credentials: { apiKey: "mk_live_abc123", terminalId: "TERM-7F3K9QX2" },
			terminalName: "Front counter",
			locationName: "KLCC",
			organizationName: "Kopi & Co",
		});
	});
});

describe("the paired terminal in Secure Store", () => {
	it("reads as unpaired when nothing was saved", async () => {
		await expect(readPairedTerminal()).resolves.toBeNull();
	});

	it("reads back what was saved", async () => {
		await savePairedTerminal(TERMINAL);

		await expect(readPairedTerminal()).resolves.toEqual(TERMINAL);
		expect(memorySecureStore.peek(SECURE_STORE_ENTRIES.tillApiKey.key)).toBe(JSON.stringify("mk_live_abc123"));
	});

	it("writes the API key last, so an interrupted save never leaves a key without its terminal", async () => {
		await savePairedTerminal(TERMINAL);

		const writtenKeys = memorySecureStore.setItemAsync.mock.calls.map(([key]): string => key);
		expect(writtenKeys.at(-1)).toBe(SECURE_STORE_ENTRIES.tillApiKey.key);
	});

	it("forgets a pairing missing a field, whole", async () => {
		await savePairedTerminal(TERMINAL);
		memorySecureStore.seed(SECURE_STORE_ENTRIES.tillTerminalId.key, JSON.stringify("not a valid id!"));

		await expect(readPairedTerminal()).resolves.toBeNull();
		expect(memorySecureStore.peek(SECURE_STORE_ENTRIES.tillApiKey.key)).toBeNull();
		expect(memorySecureStore.peek(SECURE_STORE_ENTRIES.tillTerminalName.key)).toBeNull();
	});

	it("forgets every field on unpair", async () => {
		await savePairedTerminal(TERMINAL);

		await forgetPairedTerminal();

		await expect(readPairedTerminal()).resolves.toBeNull();
		expect(memorySecureStore.peek(SECURE_STORE_ENTRIES.tillOrganizationName.key)).toBeNull();
	});
});
