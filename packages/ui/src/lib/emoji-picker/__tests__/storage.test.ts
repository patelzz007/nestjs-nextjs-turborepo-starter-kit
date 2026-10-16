import { afterEach, describe, expect, it, vi } from "vitest";

import { parseStoredRecent, parseStoredTone, readStoredValue, subscribeStoredValue, writeStoredValue } from "../storage";

afterEach((): void => {
	window.localStorage.clear();
	vi.restoreAllMocks();
});

describe("stored values", () => {
	it("writes through localStorage and tells subscribers", (): void => {
		const listener = vi.fn();
		const unsubscribe = subscribeStoredValue("emoji-test", listener);
		writeStoredValue("emoji-test", "3");
		expect(readStoredValue("emoji-test")).toBe("3");
		expect(window.localStorage.getItem("emoji-test")).toBe("3");
		expect(listener).toHaveBeenCalledTimes(1);
		unsubscribe();
		writeStoredValue("emoji-test", "4");
		expect(listener).toHaveBeenCalledTimes(1);
	});

	it("re-reads after another tab's write", (): void => {
		const listener = vi.fn();
		const unsubscribe = subscribeStoredValue("emoji-tab", listener);
		window.dispatchEvent(new StorageEvent("storage", { key: "other" }));
		expect(listener).not.toHaveBeenCalled();
		window.dispatchEvent(new StorageEvent("storage", { key: "emoji-tab" }));
		expect(listener).toHaveBeenCalledTimes(1);
		unsubscribe();
	});

	it("remembers in memory when storage refuses a write", (): void => {
		vi.spyOn(Storage.prototype, "setItem").mockImplementation((): void => {
			throw new Error("quota");
		});
		writeStoredValue("emoji-memory", "5");
		expect(readStoredValue("emoji-memory")).toBe("5");
	});
});

describe("parseStoredRecent", () => {
	it("reads entries, drops unreadable ones and floors counts at 1", (): void => {
		expect(parseStoredRecent(JSON.stringify([{ id: "1F600", count: 3 }, { id: 7 }, { id: "1F44D", count: -2 }, { id: "2764", count: "x" }]))).toStrictEqual([
			{ id: "1F600", count: 3 },
			{ id: "1F44D", count: 1 },
			{ id: "2764", count: 1 },
		]);
	});

	it("is null for nothing, broken JSON or a non-list", (): void => {
		expect(parseStoredRecent(null)).toBeNull();
		expect(parseStoredRecent("")).toBeNull();
		expect(parseStoredRecent("{")).toBeNull();
		expect(parseStoredRecent('{"id":"x"}')).toBeNull();
	});
});

describe("parseStoredTone", () => {
	it("accepts 0–5 only", (): void => {
		expect(parseStoredTone("0")).toBe(0);
		expect(parseStoredTone("5")).toBe(5);
		expect(parseStoredTone("6")).toBeNull();
		expect(parseStoredTone("2.5")).toBeNull();
		expect(parseStoredTone("")).toBeNull();
		expect(parseStoredTone(null)).toBeNull();
	});
});
