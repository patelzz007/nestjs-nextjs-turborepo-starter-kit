import type { CapabilitySlug } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";

/** Organization capabilities an API key's scope holds on the organization API (owned by pos). */
export interface ApiKeyCapabilitiesPort {
	/** `null` when the key is not a live key of its organization. */
	capabilitiesOf(actor: Extract<ActorContext, { kind: "api_key" }>): Promise<readonly CapabilitySlug[] | null>;
}
