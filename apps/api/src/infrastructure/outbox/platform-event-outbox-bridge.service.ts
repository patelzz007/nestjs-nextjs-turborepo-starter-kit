import { Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { Subscription } from "rxjs";

import { nowEpochMs } from "@workspace/shared";

import { CorrelationContextService } from "../../common/context/correlation-context.service";
import { AuthEventsService } from "../../modules/auth/services/auth-events.service";
import { ImpersonationEventsService } from "../../modules/impersonation/impersonation-events.service";
import { EmailLogEventsService } from "../../modules/notifications/email/email-log-events.service";
import { RewardsPlatformEventsService } from "../../modules/rewards/services/rewards-platform-events.service";
import { SessionsEventsService } from "../../modules/sessions/sessions-events.service";

import { PlatformOutboxService } from "../outbox/platform-outbox.service";

/**
 * Persists in-process domain events to the transactional outbox.
 * A BullMQ worker publishes rows to Kafka with retries.
 */
@Injectable()
export class PlatformEventOutboxBridgeService implements OnModuleInit, OnModuleDestroy {
	private readonly subscriptions: Subscription[] = [];

	public constructor(
		private readonly outboxService: PlatformOutboxService,
		private readonly correlationContext: CorrelationContextService,
		private readonly authEvents: AuthEventsService,
		private readonly sessionsEvents: SessionsEventsService,
		private readonly impersonationEvents: ImpersonationEventsService,
		private readonly emailLogEvents: EmailLogEventsService,
		private readonly rewardsPlatformEvents: RewardsPlatformEventsService,
	) {}

	public onModuleInit(): void {
		this.subscriptions.push(
			this.authEvents.observeFlows().subscribe((event) => {
				void this.outboxService.enqueueEnvelope(
					"platform.auth",
					{
						type: "auth.flow",
						correlationId: this.correlationContext.get() ?? null,
						occurredAt: nowEpochMs(),
						payload: event,
					},
					event.userId,
				);
			}),
			this.sessionsEvents.observeActions().subscribe((event) => {
				void this.outboxService.enqueueEnvelope(
					"platform.sessions",
					{
						type: "session.action",
						correlationId: this.correlationContext.get() ?? null,
						occurredAt: nowEpochMs(),
						payload: event,
					},
					event.userId,
				);
			}),
			this.impersonationEvents.observeActions().subscribe((event) => {
				void this.outboxService.enqueueEnvelope(
					"platform.impersonation",
					{
						type: "impersonation.action",
						correlationId: this.correlationContext.get() ?? null,
						occurredAt: nowEpochMs(),
						payload: event,
					},
					event.superAdminId,
				);
			}),
			this.emailLogEvents.observeUpdates().subscribe((event) => {
				if (event === null) {
					return;
				}
				void this.outboxService.enqueueEnvelope(
					"platform.email",
					{
						type: "email.log.updated",
						correlationId: this.correlationContext.get() ?? null,
						occurredAt: nowEpochMs(),
						payload: event,
					},
					event.to,
				);
			}),
			this.rewardsPlatformEvents.observe().subscribe((event) => {
				void this.outboxService.enqueueEnvelope(
					"platform.rewards",
					{
						type: "reward.platform",
						correlationId: this.correlationContext.get() ?? null,
						occurredAt: nowEpochMs(),
						payload: event,
					},
					event.actorUserId,
				);
			}),
		);
	}

	public onModuleDestroy(): void {
		for (const subscription of this.subscriptions) {
			subscription.unsubscribe();
		}
		this.subscriptions.length = 0;
	}
}
