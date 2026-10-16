// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	createFilterFocusStore,
	createFilterResolutionStore,
	createFilterRowStateStore,
	filterControlSizes,
	filterReadOnlyProps,
	isFilterLocked,
	useFilterActions,
	useFilterChipFocused,
	useFilterFocusEmpty,
	useFilterReorderable,
	useFilterState,
} from "./filters-context";

afterEach((): void => {
	cleanup();
});

describe("filters-context: lock and sizes", () => {
	it("locks on disabled or read only, and marks read-only controls", (): void => {
		expect(isFilterLocked({ disabled: false, readOnly: false })).toBe(false);
		expect(isFilterLocked({ disabled: true, readOnly: false })).toBe(true);
		expect(isFilterLocked({ disabled: false, readOnly: true })).toBe(true);
		expect(filterReadOnlyProps({ disabled: false, readOnly: true })).toEqual({ "aria-disabled": true, "data-readonly": true });
		expect(filterReadOnlyProps({ disabled: true, readOnly: true })).toEqual({ "aria-disabled": undefined, "data-readonly": undefined });
	});

	it("maps a bar size to one kit button ladder", (): void => {
		expect(filterControlSizes({ size: "sm" })).toEqual({ button: "xs", icon: "icon-xs" });
		expect(filterControlSizes({ size: "default" })).toEqual({ button: "sm", icon: "icon-sm" });
	});
});

describe("filters-context: stores", () => {
	it("publishes focus only on change", (): void => {
		const store = createFilterFocusStore();
		const listener = vi.fn<() => void>();
		const unsubscribe = store.subscribe(listener);
		store.set({ id: "a", segment: "value", autoOpen: false });
		const snapshot = store.getSnapshot();
		store.set({ id: "a", segment: "value", autoOpen: false });
		expect(listener).toHaveBeenCalledTimes(1);
		expect(store.getSnapshot()).toBe(snapshot);
		unsubscribe();
		store.set({ id: "b", segment: null, autoOpen: false });
		expect(listener).toHaveBeenCalledTimes(1);
	});

	it("tracks touched and pending rows with an identity-changing snapshot", (): void => {
		const store = createFilterRowStateStore();
		const before = store.touchedSnapshot();
		store.mark("r");
		store.mark("r");
		expect(store.has("r")).toBe(true);
		expect(store.touchedSnapshot()).not.toBe(before);
		expect(store.touchedSnapshot().has("r")).toBe(true);
		store.markPending("p");
		expect(store.isPending("p")).toBe(true);
		store.resolvePending("p");
		expect(store.isPending("p")).toBe(false);
		store.unmark("r");
		expect(store.has("r")).toBe(false);
		store.mark("q");
		store.reset();
		expect(store.has("q")).toBe(false);
		expect(store.version()).toBe(6);
	});

	it("resolves labels once, claims values once and releases on failure", (): void => {
		const store = createFilterResolutionStore();
		const listener = vi.fn<() => void>();
		store.subscribe(listener);
		store.set("f", [{ value: "1", label: "One" }]);
		store.set("f", [{ value: "1", label: "One" }]);
		expect(listener).toHaveBeenCalledTimes(1);
		expect(store.get("f", "1")?.label).toBe("One");
		expect(store.claim("f", ["1", "2", "3"])).toEqual(["2", "3"]);
		expect(store.claim("f", ["2"])).toEqual([]);
		store.release("f", ["2"]);
		expect(store.claim("f", ["2"])).toEqual(["2"]);
		expect(store.getVersion()).toBe(1);
	});
});

describe("filters-context: hooks", () => {
	it("throws outside a Filters root for the required contexts", (): void => {
		vi.spyOn(console, "error").mockImplementation((): void => undefined);
		expect((): void => {
			renderHook(useFilterActions);
		}).toThrow("useFilterActions must be used inside <Filters>");
		expect((): void => {
			renderHook(useFilterState);
		}).toThrow("useFilterState must be used inside <Filters>");
		vi.restoreAllMocks();
	});

	it("degrades the store hooks to their empty answers outside a root", (): void => {
		expect(renderHook(useFilterFocusEmpty).result.current).toBe(true);
		expect(renderHook(useFilterReorderable).result.current).toBe(false);
		expect(renderHook((): boolean => useFilterChipFocused("x")).result.current).toBe(false);
	});
});
