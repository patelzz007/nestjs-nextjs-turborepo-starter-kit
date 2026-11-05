import { WebhookEventDraftSchema, type EpochMs, type WebhookEventDraft } from "@workspace/shared";

import { WebhookEventRecorded } from "../../domain/events/webhook.events";
import type { WebhookIdGenerator } from "../ports/webhook-ids.port";
import type { WebhooksScope } from "../webhooks-scope";

/**
 * Writes one catalog event in the producing transaction (ADR 082): the outbox row commits with the change it
 * describes, or not at all, so an integrator never hears of a change that rolled back. The producer's session
 * may only APPEND an event (rls/66-outbound-webhooks.sql): it cannot read the tenant's endpoints (a system
 * operation's session sees none), so who receives it is decided by the fan-out, under the webhooks' own system
 * operation; an event nobody receives is fanned out to nobody and purged with the rest. After the commit it is
 * fanned out at once (`WebhookEventRecorded`); the sweeper picks up any that missed it.
 */
export async function recordWebhookEvent(scope: WebhooksScope, ids: WebhookIdGenerator, tenantId: string, draft: WebhookEventDraft, occurredAt: EpochMs): Promise<void> {
	const event = WebhookEventDraftSchema.parse(draft);
	const id = ids.next();
	await scope.webhookEvents.append({ id, tenantId, draft: event, occurredAt });
	scope.events.collect(new WebhookEventRecorded(occurredAt, id, tenantId));
}
