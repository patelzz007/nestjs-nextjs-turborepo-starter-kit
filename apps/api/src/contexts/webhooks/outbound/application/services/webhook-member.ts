import { MERCHANT_CAPABILITY, type MerchantCapability } from "@workspace/shared";

import { actingInTenant, type ActorContext } from "../../../../../platform/application/actor-context";
import { AuthenticationError } from "../../../../../platform/application/errors/app-error";
import type { MerchantAccessPort } from "../../../../../platform/application/ports/authorization.port";

/** A member allowed to work with the tenant's webhooks: their id, and the actor re-bound to that tenant. */
export interface WebhookMember {
	readonly userId: string;
	readonly actor: ActorContext;
}

/** What a webhook console command or query does, and so which catalogue verb it needs (ADR 090). */
export type WebhookAction = "view" | "create" | "manage" | "delete";

/** The capability each webhook action checks: `webhook.read`, `.create`, `.update` and `.delete`. */
export const WEBHOOK_ACTION_CAPABILITY: Readonly<Record<WebhookAction, MerchantCapability>> = {
	view: MERCHANT_CAPABILITY.viewWebhooks,
	create: MERCHANT_CAPABILITY.createWebhooks,
	manage: MERCHANT_CAPABILITY.manageWebhooks,
	delete: MERCHANT_CAPABILITY.deleteWebhooks,
};

/**
 * Every console command and query first proves the signed-in member holds the webhook capability its action needs in
 * the tenant (ADR 082, ADR 090): endpoints are managed by people, never by API keys.
 */
export async function assertWebhookMember(merchantAccess: MerchantAccessPort, actor: ActorContext, tenantId: string, action: WebhookAction): Promise<WebhookMember> {
	if (actor.kind !== "user") {
		throw new AuthenticationError({ message: "A signed-in user is required for this action." });
	}
	await merchantAccess.assertCapability(actor, { tenantId, capability: WEBHOOK_ACTION_CAPABILITY[action] });
	return { userId: actor.userId, actor: actingInTenant(actor, tenantId) };
}
