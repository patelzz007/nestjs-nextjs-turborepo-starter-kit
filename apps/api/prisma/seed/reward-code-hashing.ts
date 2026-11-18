import { getApiConfig } from "../../src/config/api-config";
import { RewardCodeHasher } from "../../src/platform/infrastructure/crypto/reward-code-hasher";

let hasher: RewardCodeHasher | null = null;

/**
 * The same keyed hash the API stores for QR tokens, backup codes and pairing
 * codes, built from the same validated `REWARD_CODE_HASH_KEYS` key ring — so
 * the demo codes printed by the seed actually work at the POS.
 */
export function seedCodeHash(code: string): string {
	hasher ??= new RewardCodeHasher(getApiConfig().encryption.rewardCodeHashKeys);
	return hasher.hash(code);
}
