import { PASSWORD_HISTORY_DEPTH } from "../../domain/value-objects/password-policy.value-object";
import type { IdentityScope } from "../identity-scope";
import type { CredentialCryptoPort } from "../ports/credential-crypto.port";

/** Whether `plainPassword` matches one of the account's last {@link PASSWORD_HISTORY_DEPTH} hashes (bcrypt, one by one). */
export async function matchesRecentPassword(scope: Pick<IdentityScope, "accounts">, crypto: CredentialCryptoPort, userId: string, plainPassword: string): Promise<boolean> {
	const hashes: readonly string[] = await scope.accounts.recentPasswordHashes(userId, PASSWORD_HISTORY_DEPTH);
	for (const hash of hashes) {
		if (await crypto.compare(plainPassword, hash)) {
			return true;
		}
	}
	return false;
}
