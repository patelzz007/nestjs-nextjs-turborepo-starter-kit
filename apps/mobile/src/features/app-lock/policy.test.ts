import { shouldLockOnResume } from "./policy";

const NOW = 1_000_000;

describe("shouldLockOnResume (§11.5)", () => {
	it("locks when the app was away for at least the timeout", () => {
		expect(shouldLockOnResume({ lockEnabled: true, backgroundedAt: NOW - 60_000, now: NOW, timeoutMs: 60_000 })).toBe(true);
		expect(shouldLockOnResume({ lockEnabled: true, backgroundedAt: NOW - 59_999, now: NOW, timeoutMs: 60_000 })).toBe(false);
	});

	it("Immediately (0) locks on every return", () => {
		expect(shouldLockOnResume({ lockEnabled: true, backgroundedAt: NOW, now: NOW, timeoutMs: 0 })).toBe(true);
	});

	it("never locks with the lock off, or without a background timestamp", () => {
		expect(shouldLockOnResume({ lockEnabled: false, backgroundedAt: NOW - 600_000, now: NOW, timeoutMs: 0 })).toBe(false);
		expect(shouldLockOnResume({ lockEnabled: true, backgroundedAt: null, now: NOW, timeoutMs: 0 })).toBe(false);
	});

	it("counts a clock that went backwards as no time away", () => {
		expect(shouldLockOnResume({ lockEnabled: true, backgroundedAt: NOW + 5_000, now: NOW, timeoutMs: 60_000 })).toBe(false);
		expect(shouldLockOnResume({ lockEnabled: true, backgroundedAt: NOW + 5_000, now: NOW, timeoutMs: 0 })).toBe(true);
	});
});
