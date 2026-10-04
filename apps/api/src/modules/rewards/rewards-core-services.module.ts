import { Module, type Provider } from "@nestjs/common";

import { TypedConfigService } from "../../config/typed-config.service";

import { OutboxModule } from "../../infrastructure/outbox/outbox.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { OrganizationModule } from "../organization/organization.module";

import { MerchantContextService } from "./services/merchant-context.service";
import { MerchantRewardService } from "./services/merchant-reward.service";
import { ReferralCreditNotificationService } from "./services/referral-credit-notification.service";
import { RewardNotificationService } from "./services/reward-notification.service";
import { RewardCodeHasher } from "./crypto/reward-code-hasher";
import { RewardsPersistenceModule } from "./rewards-persistence.module";

/** The reward code HMAC hasher, built once from the validated `REWARD_CODE_HASH_KEYS` key ring. */
const REWARD_CODE_HASHER_PROVIDER: Provider = {
	provide: RewardCodeHasher,
	useFactory: (config: TypedConfigService): RewardCodeHasher => new RewardCodeHasher(config.rewardCodeHashKeys),
	inject: [TypedConfigService],
};

/** Reward domain services shared by HTTP handlers and BullMQ maintenance workers. */
@Module({
	imports: [RewardsPersistenceModule, OrganizationModule, OutboxModule, NotificationsModule],
	providers: [MerchantContextService, RewardNotificationService, MerchantRewardService, ReferralCreditNotificationService, REWARD_CODE_HASHER_PROVIDER],
	exports: [MerchantContextService, RewardNotificationService, MerchantRewardService, ReferralCreditNotificationService, RewardCodeHasher, RewardsPersistenceModule],
})
export class RewardsCoreServicesModule {}
