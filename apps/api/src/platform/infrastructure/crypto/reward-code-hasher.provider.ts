import type { Provider } from "@nestjs/common";

import { TypedConfigService } from "../../../config/typed-config.service";
import { RewardCodeHasher } from "./reward-code-hasher";

/** The reward code HMAC hasher, built once per module from the validated `REWARD_CODE_HASH_KEYS` key ring. */
export const REWARD_CODE_HASHER_PROVIDER: Provider = {
	provide: RewardCodeHasher,
	useFactory: (config: TypedConfigService): RewardCodeHasher => new RewardCodeHasher(config.encryption.rewardCodeHashKeys),
	inject: [TypedConfigService],
};
