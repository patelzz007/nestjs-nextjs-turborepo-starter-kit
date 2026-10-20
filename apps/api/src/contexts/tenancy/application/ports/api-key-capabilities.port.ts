import type { CapabilitySlug } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";

/** Tenant capabilities an API key's scope holds on the tenant API (owned by pos). */
export interface ApiKeyCapabilitiesPort {
	/** `null` when the key is not a live key of its tenant. */
	capabilitiesOf(actor: Extract<ActorContext, { kind: "api_key" }>): Promise<readonly CapabilitySlug[] | null>;
}
