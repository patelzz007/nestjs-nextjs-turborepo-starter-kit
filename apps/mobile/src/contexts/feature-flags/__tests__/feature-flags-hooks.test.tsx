import { render, renderHook, screen } from "@testing-library/react-native";
import { epochMs, type Exposure, type FeatureFlagBundle } from "@workspace/shared";
import * as React from "react";
import { Text } from "react-native";

import { FeatureFlagGate, StaticFeatureFlagsProvider, useDynamicConfig, useEnabledFeatureFlags, useFeatureFlag } from "../feature-flags-provider";
import { MOBILE_FEATURE_FLAGS } from "..";

const NOW = 1_800_000_000_000;
const EXPERIMENT = "019b76da-a800-7000-8000-0000000000e1";

const OFF: FeatureFlagBundle = {
	version: 1,
	app: "mobile",
	evaluatedAt: epochMs(NOW),
	nextChangeAt: null,
	flags: [{ key: "mobile-analytics", on: false, source: "KILL_SWITCH", revision: null, ruleId: null }],
	configs: [
		{ key: "reward-claim-cta", valueName: "bold", value: { emphasis: "bold" }, source: "EXPERIMENT", revision: 1, ruleId: null, experimentId: EXPERIMENT, variant: "bold" },
	],
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

describe("feature flag hooks (mobile)", () => {
	it("reads the bundle, and the code default without one", async () => {
		expect((await renderHook(() => useFeatureFlag("mobile-analytics"), { wrapper: wrapperFor(OFF) })).result.current).toBe(false);
		expect((await renderHook(() => useFeatureFlag("mobile-analytics"), { wrapper: wrapperFor(null) })).result.current).toBe(true);
	});

	it("lists the app's flags that are on, recording what it decided", async () => {
		const onExposure = jest.fn<undefined, [Exposure]>();
		const { result } = await renderHook(() => useEnabledFeatureFlags(MOBILE_FEATURE_FLAGS), { wrapper: wrapperFor(OFF, onExposure) });
		expect(result.current).toEqual([]);
		expect(onExposure).toHaveBeenCalledWith(expect.objectContaining({ kind: "FLAG", key: "mobile-analytics", on: false }));
	});

	it("gives a config's value and records the experiment variant shown", async () => {
		const onExposure = jest.fn<undefined, [Exposure]>();
		const { result } = await renderHook(() => useDynamicConfig("reward-claim-cta"), { wrapper: wrapperFor(OFF, onExposure) });
		expect(result.current).toEqual({ emphasis: "bold" });
		expect(onExposure).toHaveBeenCalledWith(expect.objectContaining({ kind: "CONFIG", experimentId: EXPERIMENT, variant: "bold" }));
	});

	it("shows the fallback while a flag is off", async () => {
		await render(
			<StaticFeatureFlagsProvider bundle={OFF}>
				<FeatureFlagGate flag="mobile-analytics" fallback={<Text>off</Text>}>
					<Text>on</Text>
				</FeatureFlagGate>
			</StaticFeatureFlagsProvider>,
		);
		expect(screen.getByText("off")).toBeTruthy();
		expect(screen.queryByText("on")).toBeNull();
	});
});
