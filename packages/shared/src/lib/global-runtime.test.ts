import { afterEach, describe, expect, it, vi } from "vitest";

import { hasGlobalConstructor, hasGlobalValue, isBrowserRuntime } from "./global-runtime";

describe("global-runtime", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("hasGlobalConstructor is true for a callable global", () => {
		expect(hasGlobalConstructor("Object")).toBe(true);
	});

	it("hasGlobalConstructor is false for a missing global or one stubbed to undefined", () => {
		expect(hasGlobalConstructor("DefinitelyNotAGlobal")).toBe(false);
		vi.stubGlobal("BroadcastChannel", undefined);
		expect(hasGlobalConstructor("BroadcastChannel")).toBe(false);
	});

	it("hasGlobalConstructor is false for a non-callable object global", () => {
		vi.stubGlobal("FakeObserver", { kind: "observer" });
		expect(hasGlobalConstructor("FakeObserver")).toBe(false);
	});

	it("hasGlobalValue sees object and function globals, not primitives or absent ones", () => {
		vi.stubGlobal("fakeWindow", {});
		vi.stubGlobal("fakeFlag", "on");
		expect(hasGlobalValue("fakeWindow")).toBe(true);
		expect(hasGlobalValue("Object")).toBe(true);
		expect(hasGlobalValue("fakeFlag")).toBe(false);
		expect(hasGlobalValue("DefinitelyNotAGlobal")).toBe(false);
	});

	it("isBrowserRuntime needs both window and document", () => {
		vi.stubGlobal("window", undefined);
		vi.stubGlobal("document", undefined);
		expect(isBrowserRuntime()).toBe(false);
		vi.stubGlobal("window", {});
		expect(isBrowserRuntime()).toBe(false);
		vi.stubGlobal("document", {});
		expect(isBrowserRuntime()).toBe(true);
	});
});
