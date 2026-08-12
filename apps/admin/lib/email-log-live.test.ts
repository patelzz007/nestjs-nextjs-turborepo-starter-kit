import { describe, expect, it } from "vitest";

import { LiveStateSchema, mapReadyState } from "@/lib/email-log-live";

describe("mapReadyState", () => {
	it("maps the EventSource ready-state numbers to LiveState", () => {
		// 0 CONNECTING, 1 OPEN, 2 CLOSED (spec-defined constants).
		expect(mapReadyState(0)).toBe("connecting");
		expect(mapReadyState(1)).toBe("open");
		expect(mapReadyState(2)).toBe("closed");
	});

	it("treats any unknown value as closed", () => {
		expect(mapReadyState(99)).toBe("closed");
		expect(mapReadyState(-1)).toBe("closed");
	});

	it("every mapped value is a valid LiveState", () => {
		for (const readyState of [0, 1, 2]) {
			expect(LiveStateSchema.safeParse(mapReadyState(readyState)).success).toBe(true);
		}
	});
});
