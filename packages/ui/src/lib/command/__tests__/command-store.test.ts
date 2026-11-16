import { describe, expect, it, vi } from "vitest";

import { createCommandStore, type CommandItemRecord } from "@workspace/ui/lib/command/command-store";

function record(value: string, overrides: Partial<CommandItemRecord> = {}): CommandItemRecord {
	return { value, keywords: [], groupId: undefined, alwaysVisible: false, ...overrides };
}

describe("createCommandStore", () => {
	it("shows items that are not registered yet, then filters registered ones by the search", () => {
		const store = createCommandStore();
		expect(store.isItemVisible("a")).toBe(true);
		store.upsert("a", record("Users"));
		store.upsert("b", record("Roles"));
		store.setSearch("use");
		expect(store.isItemVisible("a")).toBe(true);
		expect(store.isItemVisible("b")).toBe(false);
		expect(store.getVisibleCount()).toBe(1);
	});

	it("hides a group only once it has items and none match", () => {
		const store = createCommandStore();
		expect(store.isGroupVisible("g")).toBe(true);
		store.upsert("a", record("Users", { groupId: "g" }));
		store.setSearch("zzz");
		expect(store.isGroupVisible("g")).toBe(false);
		store.setSearch("");
		expect(store.isGroupVisible("g")).toBe(true);
	});

	it("keeps forced items and everything when filtering is off", () => {
		const store = createCommandStore();
		store.upsert("a", record("Users", { alwaysVisible: true }));
		store.upsert("b", record("Roles"));
		store.setSearch("zzz");
		expect(store.isItemVisible("a")).toBe(true);
		expect(store.isItemVisible("b")).toBe(false);
		store.setOptions({ shouldFilter: false, filter: (): number => 0 });
		expect(store.isItemVisible("b")).toBe(true);
	});

	it("uses a custom filter", () => {
		const store = createCommandStore();
		store.upsert("a", record("Users", { keywords: ["people"] }));
		store.setOptions({ shouldFilter: true, filter: (_value: string, _search: string, keywords: readonly string[]): number => (keywords.includes("people") ? 1 : 0) });
		store.setSearch("anything");
		expect(store.isItemVisible("a")).toBe(true);
	});

	it("notifies on real changes only and versions the item set", () => {
		const store = createCommandStore("Users");
		const listener = vi.fn<() => void>();
		const unsubscribe = store.subscribe(listener);
		store.upsert("a", record("Users"));
		store.upsert("a", record("Users"));
		expect(listener).toHaveBeenCalledTimes(1);
		expect(store.getVersion()).toBe(1);
		store.setSelectedValue("Users");
		store.setSearch("");
		expect(listener).toHaveBeenCalledTimes(1);
		store.remove("a");
		store.remove("a");
		expect(store.getVersion()).toBe(2);
		unsubscribe();
		store.setSearch("x");
		expect(listener).toHaveBeenCalledTimes(2);
	});

	it("finds the visible item holding a value", () => {
		const store = createCommandStore();
		store.upsert("a", record("Users"));
		expect(store.getItemIdByValue("Users")).toBe("a");
		store.setSearch("zzz");
		expect(store.getItemIdByValue("Users")).toBeUndefined();
	});
});
