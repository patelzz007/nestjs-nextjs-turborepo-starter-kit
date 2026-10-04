import { RewardCodeHashKeysEnvSchema } from "../../src/config/api-env.fields";
import { RewardCodeHasher } from "../../src/modules/rewards/crypto/reward-code-hasher";

let hasher: RewardCodeHasher | null = null;

/**
 * The same keyed hash the API stores for QR tokens, backup codes and pairing
 * codes, built from the same validated `REWARD_CODE_HASH_KEYS` key ring — so
 * the demo codes printed by the seed actually work at the POS.
 */
export function seedCodeHash(code: string): string {
	hasher ??= new RewardCodeHasher(RewardCodeHashKeysEnvSchema.parse(process.env.REWARD_CODE_HASH_KEYS));
	return hasher.hash(code);
}
