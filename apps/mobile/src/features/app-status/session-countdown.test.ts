import { didTokenRotate, formatTimeLeft, secondsUntil } from "./session-countdown";

const NOW_MS = 1_791_504_000_000;

describe("secondsUntil", () => {
	it("counts whole seconds to the expiry", () => {
		expect(secondsUntil(NOW_MS + 90_000, NOW_MS)).toBe(90);
	});

	it("rounds a part second to the nearest second", () => {
		expect(secondsUntil(NOW_MS + 1_400, NOW_MS)).toBe(1);
		expect(secondsUntil(NOW_MS + 1_600, NOW_MS)).toBe(2);
	});

	it("never goes below zero once the token has expired", () => {
		expect(secondsUntil(NOW_MS - 5_000, NOW_MS)).toBe(0);
	});
});

describe("didTokenRotate", () => {
	it("is a rotation when the expiry moves later", () => {
		expect(didTokenRotate(NOW_MS, NOW_MS + 1)).toBe(true);
	});

	it.each([
		["the same expiry", NOW_MS, NOW_MS],
		["an earlier expiry", NOW_MS, NOW_MS - 1],
		["the first sighting", null, NOW_MS],
		["a token without expiry", NOW_MS, null],
	])("is not a rotation for %s", (_what, previous, next) => {
		expect(didTokenRotate(previous, next)).toBe(false);
	});
});

describe("formatTimeLeft", () => {
	it("shows minutes and two-digit seconds", () => {
		expect(formatTimeLeft(872, false)).toBe("14m 32s");
		expect(formatTimeLeft(9, false)).toBe("0m 09s");
		expect(formatTimeLeft(0, true)).toBe("0m 00s");
	});

	it("keeps minutes and seconds past an hour in full", () => {
		expect(formatTimeLeft(9_000, false)).toBe("150m 00s");
	});

	it("shortens an hour or more to hours and two-digit minutes when compact", () => {
		expect(formatTimeLeft(9_000, true)).toBe("2h 30m");
		expect(formatTimeLeft(3_900, true)).toBe("1h 05m");
	});

	it("keeps minutes and seconds under an hour when compact", () => {
		expect(formatTimeLeft(3_599, true)).toBe("59m 59s");
	});
});
