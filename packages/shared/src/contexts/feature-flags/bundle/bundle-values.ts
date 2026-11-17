import type { EpochMs } from "../../../schemas/api/common";
import type { ConfigResult, Exposure, FeatureFlagBundle, FlagResult } from "../schemas/bundle";
import { DYNAMIC_CONFIG_REGISTRY, type DynamicConfigKey, type DynamicConfigValues } from "../schemas/dynamic-configs";
import { FEATURE_FLAG_REGISTRY, type FeatureFlagKey } from "../schemas/registry";

// ── Reading a bundle (ADR 087) ───────────────────────────────────────────────────────────────────
// Every client (the web apps and the mobile app) reads a bundle the same way. A flag or config the bundle doesn't
// carry (not loaded yet, or the API couldn't answer) reads as its code default: a screen never shows something
// because a read failed.

/** The flag's result in the bundle, or null when it isn't there. */
export function flagResultOf(bundle: FeatureFlagBundle | null, key: FeatureFlagKey): FlagResult | null {
	return bundle?.flags.find((flag) => flag.key === key) ?? null;
}

/** Whether a flag is on: the bundle's answer, else the code default. */
export function isFlagOn(bundle: FeatureFlagBundle | null, key: FeatureFlagKey): boolean {
	return flagResultOf(bundle, key)?.on ?? FEATURE_FLAG_REGISTRY[key].defaultOn;
}

/** Whether two keys are the same (as strings: the registry may declare a single config, which makes the key types equal). */
function sameKey(left: string, right: string): boolean {
	return left === right;
}

/** The config's result in the bundle, or null when it isn't there. */
export function configResultOf(bundle: FeatureFlagBundle | null, key: DynamicConfigKey): ConfigResult | null {
	return bundle?.configs.find((config) => sameKey(config.key, key)) ?? null;
}

/** A config's value, checked against its declared shape: the bundle's, else the code default. */
export function configValueOf<K extends DynamicConfigKey>(bundle: FeatureFlagBundle | null, key: K): DynamicConfigValues[K] {
	const definition = DYNAMIC_CONFIG_REGISTRY[key];
	const parsed = definition.schema.safeParse(configResultOf(bundle, key)?.value);
	return parsed.success ? parsed.data : definition.defaultValue;
}

/** The exposure a rendered flag result makes. */
export function flagExposure(result: FlagResult, at: EpochMs): Exposure {
	return { kind: "FLAG", key: result.key, on: result.on, source: result.source, revision: result.revision, ruleId: result.ruleId, at };
}

/** The exposure a rendered config result makes. */
export function configExposure(result: ConfigResult, at: EpochMs): Exposure {
	return {
		kind: "CONFIG",
		key: result.key,
		valueName: result.valueName,
		source: result.source,
		revision: result.revision,
		ruleId: result.ruleId,
		experimentId: result.experimentId,
		variant: result.variant,
		at,
	};
}
