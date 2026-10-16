import { describe, expect, it } from "vitest";

import { parseCreateTerminalForm } from "@/lib/terminals/create-terminal-form";
import { STORE_A } from "@/test/terminals";

describe("parseCreateTerminalForm", () => {
	it("omits a blank terminal id so the API generates one", () => {
		expect(parseCreateTerminalForm({ name: " Front counter ", storeId: STORE_A.id, terminalId: "  " })).toEqual({ name: "Front counter", locationId: STORE_A.id });
	});

	it("passes the merchant's own terminal id through the shared schema", () => {
		expect(parseCreateTerminalForm({ name: "Front counter", storeId: STORE_A.id, terminalId: "KL-REGISTER-01" })).toEqual({
			name: "Front counter",
			locationId: STORE_A.id,
			terminalId: "KL-REGISTER-01",
		});
	});

	it("refuses a terminal id the shared schema rejects, and a missing store", () => {
		expect(parseCreateTerminalForm({ name: "Front counter", storeId: STORE_A.id, terminalId: "bad id!" })).toBeUndefined();
		expect(parseCreateTerminalForm({ name: "Front counter", storeId: "", terminalId: "" })).toBeUndefined();
	});
});
