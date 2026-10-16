import { isInactiveState, resolveControlState } from "../control-state";

describe("resolveControlState", () => {
	it("is default with nothing set", () => {
		expect(resolveControlState({})).toBe("default");
	});

	it("shows an error only for an active control", () => {
		expect(resolveControlState({ invalid: true })).toBe("error");
		expect(resolveControlState({ invalid: true, loading: true })).toBe("loading");
		expect(resolveControlState({ invalid: true, loading: true, disabled: true })).toBe("disabled");
	});
});

describe("isInactiveState", () => {
	it("is true for disabled and loading, false otherwise", () => {
		expect(isInactiveState("disabled")).toBe(true);
		expect(isInactiveState("loading")).toBe(true);
		expect(isInactiveState("error")).toBe(false);
		expect(isInactiveState("default")).toBe(false);
	});
});
