import { Module } from "@nestjs/common";

import { AuthModule } from "../../modules/auth/auth.module";
import { ImpersonationModule } from "../../modules/impersonation/impersonation.module";
import { NotificationsModule } from "../../modules/notifications/notifications.module";
import { RewardsModule } from "../../modules/rewards/rewards.module";
import { SessionsModule } from "../../modules/sessions/sessions.module";

import { OutboxModule } from "../outbox/outbox.module";
import { PlatformEventOutboxBridgeService } from "../outbox/platform-event-outbox-bridge.service";

/** Subscribes domain event emitters and persists envelopes to the outbox. */
@Module({
	imports: [OutboxModule, AuthModule, SessionsModule, ImpersonationModule, NotificationsModule, RewardsModule],
	providers: [PlatformEventOutboxBridgeService],
})
export class PlatformEventsModule {}
