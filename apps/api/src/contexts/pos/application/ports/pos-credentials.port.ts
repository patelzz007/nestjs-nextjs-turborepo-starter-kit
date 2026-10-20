import type { PosPairingCode } from "@workspace/shared";

/** A fresh pairing code: the plaintext shown once in the console, and its keyed hash (what is stored). */
export interface IssuedPairingSecret {
	readonly code: PosPairingCode;
	readonly hash: string;
}

/** A fresh API key: the plaintext shown once, its sha256 (what is stored) and its display prefix. */
export interface IssuedApiKeySecret {
	readonly plaintext: string;
	readonly hash: string;
	readonly prefix: string;
}

/** The secrets tills and integrations authenticate with. */
export interface PosCredentialsPort {
	newPairingCode(): IssuedPairingSecret;
	/** Every stored hash a presented pairing code may have (one per key version of the hasher). */
	pairingCodeLookups(code: PosPairingCode): readonly string[];
	/** A generated terminal id (`TERM-` + 8 unambiguous characters). */
	newTerminalId(): string;
	newApiKey(): IssuedApiKeySecret;
}
