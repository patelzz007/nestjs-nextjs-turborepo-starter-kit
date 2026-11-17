import type { TierSettingsResponse, UpdateTierSettingsInput } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { Clock } from "../../../../platform/application/clock.port";
import type { TierSettingsStore } from "../ports/tier-settings.store";

/**
 * The platform's tier rules for platform staff (ADR 085): read them, and change them with a reason. A change applies at
 * the next nightly review (warnings first: nobody is demoted without one), and to promotions at once.
 */
export class TierSettingsService {
	public constructor(
		private readonly store: TierSettingsStore,
		private readonly clock: Clock,
	) {}

	public settings(actor: ActorContext): Promise<TierSettingsResponse> {
		return this.store.settings(actor);
	}

	public update(actor: ActorContext, input: UpdateTierSettingsInput): Promise<TierSettingsResponse> {
		return this.store.save(actor, input, this.clock.now());
	}
}
