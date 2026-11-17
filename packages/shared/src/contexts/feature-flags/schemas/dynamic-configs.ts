import { z } from "zod";

import type { JsonObject } from "../../../schemas/runtime/json";
import type { FlagApp, RolloutUnit } from "./registry";

// ── Declared dynamic configs (GLOSSARY: dynamic config) ──────────────────────────────────────────
// A dynamic config returns a value, never on/off. Its value's shape is declared here as a zod schema;
// staff edit named values in the console (checked against it there and again by the API), and rules
// or a running experiment pick which value a subject gets. A value must never hold a secret or personal data.

export const DynamicConfigKeySchema = z.enum(["reward-claim-cta"]);
export type DynamicConfigKey = z.output<typeof DynamicConfigKeySchema>;

/** How strongly the reward page's Claim button is drawn. */
export const RewardClaimCtaValueSchema = z.object({ emphasis: z.enum(["standard", "bold"]) }).strict();
export type RewardClaimCtaValue = z.output<typeof RewardClaimCtaValueSchema>;

/** Every config's value schema, by key (a config's key is kebab-case, as a flag's). */
const DynamicConfigValuesSchema = z.object({ "reward-claim-cta": RewardClaimCtaValueSchema });
/** Every config's value type, by key: what `useDynamicConfig(key)` answers. */
export type DynamicConfigValues = Readonly<z.output<typeof DynamicConfigValuesSchema>>;

export interface DynamicConfigDefinition<TValue extends JsonObject> {
	readonly title: string;
	readonly description: string;
	readonly rolloutUnit: RolloutUnit;
	readonly apps: readonly FlagApp[];
	readonly schema: z.ZodType<TValue>;
	/** The value when no rule or experiment decides. */
	readonly defaultValue: TValue;
}

export const DYNAMIC_CONFIG_REGISTRY: { readonly [K in DynamicConfigKey]: DynamicConfigDefinition<DynamicConfigValues[K]> } = {
	"reward-claim-cta": {
		title: "Reward claim button",
		description: "How strongly the Claim button on a reward's page is drawn, on the web and in the mobile app.",
		rolloutUnit: "USER",
		apps: ["web", "mobile"],
		schema: RewardClaimCtaValueSchema,
		defaultValue: { emphasis: "standard" },
	},
};

/** The declared configs a bundle for `app` carries, in declaration order. */
export function dynamicConfigKeysFor(app: FlagApp): readonly DynamicConfigKey[] {
	return DynamicConfigKeySchema.options.filter((key) => DYNAMIC_CONFIG_REGISTRY[key].apps.includes(app));
}

/** Whether a stored value fits the config's declared shape (the console's live check and the API's). */
export function isValidDynamicConfigValue(key: DynamicConfigKey, value: JsonObject): boolean {
	return DYNAMIC_CONFIG_REGISTRY[key].schema.safeParse(value).success;
}
