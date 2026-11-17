import type { EpochMs, TierRules, TierSettingsResponse, UpdateTierSettingsInput } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";

/** The platform's tier rules (ADR 085): one row, the defaults until staff first change it. */
export interface TierSettingsStore {
	/** The rules in force, for the evaluation and the read side. */
	rules(): Promise<TierRules>;
	/** The rules with who last changed them and why, for platform staff. */
	settings(actor: ActorContext): Promise<TierSettingsResponse>;
	/** Replaces the rules with a reason (the request audit and the row's change capture keep both). */
	save(actor: ActorContext, input: UpdateTierSettingsInput, at: EpochMs): Promise<TierSettingsResponse>;
}
