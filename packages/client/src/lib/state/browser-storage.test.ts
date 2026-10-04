import { describe, expect, it, vi } from "vitest";

import { createResilientStorage } from "./browser-storage";

/** A `Storage` whose writes fail like a full quota. */
class QuotaFullStorage implements Storage {
	private readonly _values = new Map<string, string>();

	public get length(): number {
		return this._values.size;
	}

	public clear(): void {
		this._values.clear();
	}

	public getItem(key: string): string | null {
		return this._values.get(key) ?? null;
	}

	public key(index: number): string | null {
		return [...this._values.keys()][index] ?? null;
	}

	public removeItem(key: string): void {
		this._values.delete(key);
	}

	public setItem(): void {
		throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
	}
}

describe("createResilientStorage", () => {
	it("keeps values in memory for the page when the browser blocks storage (SecurityError on access)", () => {
		const storage = createResilientStorage(null, vi.fn<(problem: string) => void>());

		storage.setItem("key", "value");

		expect(storage.getItem("key")).toBe("value");
		storage.removeItem("key");
		expect(storage.getItem("key")).toBeNull();
	});

	it("falls back to memory when a write hits the quota, and reports it once — never silently", () => {
		const report = vi.fn<(problem: string) => void>();
		const storage = createResilientStorage(new QuotaFullStorage(), report);

		expect((): void => {
			storage.setItem("a", "1");
			storage.setItem("b", "2");
		}).not.toThrow();

		expect(storage.getItem("a")).toBe("1");
		expect(storage.getItem("b")).toBe("2");
		expect(report).toHaveBeenCalledTimes(1);
		expect(report.mock.calls[0]?.[0]).toContain("QuotaExceededError");
	});

	it("rethrows anything that is not a storage refusal (a programming error)", () => {
		const broken = new QuotaFullStorage();
		broken.getItem = (): string | null => {
			throw new TypeError("bug");
		};
		const storage = createResilientStorage(broken, vi.fn<(problem: string) => void>());

		expect(() => storage.getItem("a")).toThrow(TypeError);
	});
});
