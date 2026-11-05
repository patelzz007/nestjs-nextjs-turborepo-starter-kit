import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { epochMs, type WebhookEndpointWithSecret } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../../platform/application/clock.port";
import type { MerchantAccessPort } from "../../../../../../platform/application/ports/authorization.port";
import type { UnitOfWork } from "../../../../../../platform/application/unit-of-work.port";
import { MERCHANT_ACCESS } from "../../../../../tenancy/public-api";
import type { WebhookSecretsPort } from "../../ports/webhook-secrets.port";
import { WEBHOOKS_UNIT_OF_WORK, WEBHOOK_SECRETS } from "../../ports/webhooks-outbound.tokens";
import { changeLiveEndpoint } from "../../services/endpoint-change";
import { webhookEndpointSummaryOf } from "../../services/webhook-endpoint-summary";
import { assertWebhookMember } from "../../services/webhook-member";
import type { WebhooksScope } from "../../webhooks-scope";
import { RotateWebhookSecretCommand } from "./rotate-webhook-secret.command";

/** Milliseconds in an hour: the grace is asked for in hours. */
const MS_PER_HOUR = 3_600_000;

/**
 * Replaces an endpoint's signing secret (answered this once). For `keepPreviousForHours` the previous secret still
 * signs every delivery alongside the new one, so the integrator can switch without missing one; 0 stops it at once
 * (a leaked secret).
 */
@CommandHandler(RotateWebhookSecretCommand)
export class RotateWebhookSecretHandler implements ICommandHandler<RotateWebhookSecretCommand, WebhookEndpointWithSecret> {
	public constructor(
		@Inject(WEBHOOKS_UNIT_OF_WORK) private readonly uow: UnitOfWork<WebhooksScope>,
		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		@Inject(CLOCK) private readonly clock: Clock,
		@Inject(WEBHOOK_SECRETS) private readonly secrets: WebhookSecretsPort,
	) {}

	public async execute(command: RotateWebhookSecretCommand): Promise<WebhookEndpointWithSecret> {
		const { input } = command;
		const member = await assertWebhookMember(this.merchantAccess, command.actor, input.tenantId);
		const now = this.clock.now();
		const next = this.secrets.create(input.endpointId);
		const previousSignsUntil = input.keepPreviousForHours === 0 ? null : epochMs(now + input.keepPreviousForHours * MS_PER_HOUR);
		const endpoint = await this.uow.run(member.actor, (scope: WebhooksScope) =>
			changeLiveEndpoint(scope, input.tenantId, input.endpointId, (live): void => {
				live.rotateSecret(next.sealed, previousSignsUntil, now);
			}),
		);
		return { endpoint: webhookEndpointSummaryOf(endpoint), secret: next.plaintext };
	}
}
