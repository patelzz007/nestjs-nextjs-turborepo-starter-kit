// @vitest-environment jsdom
import { cleanup, render, renderHook, screen } from "@testing-library/react";
import { epochMs, type Exposure, type FeatureFlagBundle, type FeatureFlagKey } from "@workspace/shared";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FeatureFlagGate, StaticFeatureFlagsProvider, useDynamicConfig, useEnabledFeatureFlags, useFeatureFlag } from "../feature-flags-context";

const RULE = "019b76da-a800-7000-8000-0000000000a1";
const NOW = 1_800_000_000_000;
const MENU_FLAGS: readonly FeatureFlagKey[] = ["web-activity", "merchant-analytics"];

const BUNDLE: FeatureFlagBundle = {
	version: 3,
	app: "web",
	evaluatedAt: epochMs(NOW),
	nextChangeAt: null,
	flags: [{ key: "web-activity", on: false, source: "KILL_SWITCH", revision: null, ruleId: null }],
	configs: [{ key: "reward-claim-cta", valueName: "bold", value: { emphasis: "bold" }, source: "EXPERIMENT", revision: 1, ruleId: null, experimentId: RULE, variant: "bold" }],
};

function wrapperFor(bundle: FeatureFlagBundle | null, onExposure?: (exposure: Exposure) => void): React.FC<{ readonly children: React.ReactNode }> {
	return function Wrapper({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
		return (
			<StaticFeatureFlagsProvider bundle={bundle} onExposure={onExposure}>
				{children}
			</StaticFeatureFlagsProvider>
		);
	};
}

afterEach((): void => {
	cleanup();
});

describe("StaticFeatureFlagsProvider", () => {
	it("answers from its bundle, and the code default for what it doesn't carry", () => {
		const { result } = renderHook(() => ({ activity: useFeatureFlag("web-activity"), analytics: useFeatureFlag("merchant-analytics") }), { wrapper: wrapperFor(BUNDLE) });
		expect(result.current).toStrictEqual({ activity: false, analytics: true });
	});

	it("reads every flag and config as its code default without a bundle", () => {
		const { result } = renderHook(() => ({ activity: useFeatureFlag("web-activity"), cta: useDynamicConfig("reward-claim-cta") }), { wrapper: wrapperFor(null) });
		expect(result.current).toStrictEqual({ activity: true, cta: { emphasis: "standard" } });
	});

	it("reports what a screen renders to the exposure callback", () => {
		const onExposure = vi.fn<(exposure: Exposure) => void>();
		renderHook(() => useDynamicConfig("reward-claim-cta"), { wrapper: wrapperFor(BUNDLE, onExposure) });
		expect(onExposure).toHaveBeenCalledWith(expect.objectContaining({ kind: "CONFIG", key: "reward-claim-cta", valueName: "bold", experimentId: RULE, variant: "bold" }));
	});

	it("gates children on a flag, showing the fallback while it's off", () => {
		render(
			<StaticFeatureFlagsProvider bundle={BUNDLE}>
				<FeatureFlagGate flag="web-activity" fallback={<p>off</p>}>
					<p>on</p>
				</FeatureFlagGate>
			</StaticFeatureFlagsProvider>,
		);
		expect(screen.getByText("off")).toBeTruthy();
		expect(screen.queryByText("on")).toBeNull();
	});

	it("refuses to be read outside a provider", () => {
		vi.spyOn(console, "error").mockImplementation((): void => {
			// React reports the thrown render error
		});
		expect(() => renderHook(() => useFeatureFlag("web-activity"))).toThrow("Feature flags are read inside FeatureFlagsProvider");
	});
});

describe("useEnabledFeatureFlags", () => {
	it("lists the menu's flags that are on, and records an exposure for each the bundle decided", () => {
		const onExposure = vi.fn<(exposure: Exposure) => void>();
		const { result } = renderHook(() => useEnabledFeatureFlags(MENU_FLAGS), { wrapper: wrapperFor(BUNDLE, onExposure) });
		expect(result.current).toStrictEqual(["merchant-analytics"]);
		expect(onExposure).toHaveBeenCalledTimes(1);
		expect(onExposure).toHaveBeenCalledWith(expect.objectContaining({ kind: "FLAG", key: "web-activity", on: false }));
	});
});
