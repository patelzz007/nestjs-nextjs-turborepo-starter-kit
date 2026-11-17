"use client";

import {
	configExposure,
	configResultOf,
	configValueOf,
	epochMs,
	flagExposure,
	flagResultOf,
	isFlagOn,
	type DynamicConfigKey,
	type DynamicConfigValues,
	type Exposure,
	type FeatureFlagBundle,
	type FeatureFlagKey,
} from "@workspace/shared";
import * as React from "react";

// ── Reading flags on screen (ADR 087) ────────────────────────────────────────────────────────────
// The context every flag hook reads, apart from where its bundle comes from: the live provider (the API and its
// stream, feature-flags-provider.tsx) or a fixed bundle (tests, previews). Nothing here touches the API, so a screen's
// hooks and the test providers never pull the auth facade in.

export interface FeatureFlagsContextValue {
	readonly bundle: FeatureFlagBundle | null;
	readonly note: (exposure: Exposure) => void;
}

export const FeatureFlagsContext = React.createContext<FeatureFlagsContextValue | null>(null);
FeatureFlagsContext.displayName = "FeatureFlagsContext";

export interface StaticFeatureFlagsProviderProps {
	/** The fixed answers; null reads every flag and config as its code default. */
	readonly bundle: FeatureFlagBundle | null;
	/** Where the exposures rendering records go (nowhere by default). */
	readonly onExposure?: ((exposure: Exposure) => void) | undefined;
	readonly children: React.ReactNode;
}

function ignoreExposure(): void {
	// A fixed bundle reports to no one unless asked to.
}

/** Feature flags from a fixed bundle, with no API: for tests (and previews) of screens that read flags. */
export function StaticFeatureFlagsProvider({ bundle, onExposure = ignoreExposure, children }: StaticFeatureFlagsProviderProps): React.JSX.Element {
	const value = React.useMemo((): FeatureFlagsContextValue => ({ bundle, note: onExposure }), [bundle, onExposure]);
	return <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>;
}

function useFlagsContext(): FeatureFlagsContextValue {
	const context = React.useContext(FeatureFlagsContext);
	if (context === null) {
		throw new Error("Feature flags are read inside FeatureFlagsProvider");
	}
	return context;
}

/** Whether a feature flag is on for this person; rendering it records an exposure. The code default until loaded. */
export function useFeatureFlag(key: FeatureFlagKey): boolean {
	const { bundle, note } = useFlagsContext();
	const result = flagResultOf(bundle, key);
	React.useEffect(() => {
		if (result !== null) {
			note(flagExposure(result, epochMs(Date.now())));
		}
	}, [note, result]);
	return isFlagOn(bundle, key);
}

/**
 * Which of `keys` are on for this person: for a menu, whose items each carry a flag (`featureFlag` in the sidebar
 * JSON). Each flag shown or hidden by it records an exposure, as a gated section does.
 */
export function useEnabledFeatureFlags(keys: readonly FeatureFlagKey[]): readonly FeatureFlagKey[] {
	const { bundle, note } = useFlagsContext();
	const results = React.useMemo(() => keys.map((key) => flagResultOf(bundle, key)).filter((result) => result !== null), [bundle, keys]);
	React.useEffect(() => {
		const at = epochMs(Date.now());
		for (const result of results) {
			note(flagExposure(result, at));
		}
	}, [note, results]);
	return React.useMemo(() => keys.filter((key) => isFlagOn(bundle, key)), [bundle, keys]);
}

/** A dynamic config's value for this person, checked against its declared shape; rendering it records an exposure. */
export function useDynamicConfig<K extends DynamicConfigKey>(key: K): DynamicConfigValues[K] {
	const { bundle, note } = useFlagsContext();
	const result = configResultOf(bundle, key);
	React.useEffect(() => {
		if (result !== null) {
			note(configExposure(result, epochMs(Date.now())));
		}
	}, [note, result]);
	return configValueOf(bundle, key);
}

export interface FeatureFlagGateProps {
	readonly flag: FeatureFlagKey;
	/** Shown while the flag is off (nothing by default). */
	readonly fallback?: React.ReactNode;
	readonly children: React.ReactNode;
}

/** Renders `children` only while `flag` is on. */
export function FeatureFlagGate({ flag, fallback = null, children }: FeatureFlagGateProps): React.JSX.Element {
	return <>{useFeatureFlag(flag) ? children : fallback}</>;
}
