import { MERCHANT_CAPABILITY } from "@workspace/shared";

import { actingInTenant, type ActorContext } from "../../../../../platform/application/actor-context";
import { AuthenticationError } from "../../../../../platform/application/errors/app-error";
import type { MerchantAccessPort } from "../../../../../platform/application/ports/authorization.port";

/** A member allowed to manage the tenant's webhooks: their id, and the actor re-bound to that tenant. */
export interface WebhookMember {
	readonly userId: string;
	readonly actor: ActorContext;
}

/**
 * Every console command and query first proves the signed-in member holds `merchant:manage_webhooks` in the
 * tenant (ADR 082): endpoints are managed by people, never by API keys.
 */
export async function assertWebhookMember(merchantAccess: MerchantAccessPort, actor: ActorContext, tenantId: string): Promise<WebhookMember> {
	if (actor.kind !== "user") {
		throw new AuthenticationError({ message: "A signed-in user is required for this action." });
	}
	await merchantAccess.assertCapability(actor, { tenantId, capability: MERCHANT_CAPABILITY.manageWebhooks });
	return { userId: actor.userId, actor: actingInTenant(actor, tenantId) };
}
