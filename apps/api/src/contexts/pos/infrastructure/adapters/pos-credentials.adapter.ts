import { Injectable } from "@nestjs/common";
import { PosPairingCodeSchema, PosTerminalIdSchema, type PosPairingCode } from "@workspace/shared";

import { opensslRandBase64OneLine } from "../../../../platform/infrastructure/crypto/openssl-rand-base64";
import { RewardCodeHasher } from "../../../../platform/infrastructure/crypto/reward-code-hasher";
import { sha256Hex } from "../../../../platform/infrastructure/crypto/sha256";
import { unambiguousCode } from "../../../../platform/infrastructure/crypto/unambiguous-code";
import type { IssuedApiKeySecret, IssuedPairingSecret, PosCredentialsPort } from "../../application/ports/pos-credentials.port";
import { API_KEY_PLAINTEXT_PREFIX, API_KEY_PREFIX_LENGTH } from "../../domain/value-objects/api-key-format.value-object";

/** Characters of a pairing code, and of a generated terminal id after its prefix. */
const CODE_LENGTH = 8;
/** Prefix of every generated terminal id (`TERM-7F3K9QX2`, ≈ 1.1 × 10¹² values per tenant). */
const TERMINAL_ID_PREFIX = "TERM-";

/**
 * Pairing codes are stored as keyed hashes (the key ring rotates, so a lookup tries every key version);
 * API keys as sha256 of `mk_live_` + `openssl rand -base64 128`.
 */
@Injectable()
export class PosCredentialsAdapter implements PosCredentialsPort {
	public constructor(private readonly hasher: RewardCodeHasher) {}

	public newPairingCode(): IssuedPairingSecret {
		const code = PosPairingCodeSchema.parse(unambiguousCode(CODE_LENGTH));
		return { code, hash: this.hasher.hash(code) };
	}

	public pairingCodeLookups(code: PosPairingCode): readonly string[] {
		return this.hasher.lookupCandidates(code);
	}

	public newTerminalId(): string {
		return PosTerminalIdSchema.parse(`${TERMINAL_ID_PREFIX}${unambiguousCode(CODE_LENGTH)}`);
	}

	public newApiKey(): IssuedApiKeySecret {
		const plaintext = `${API_KEY_PLAINTEXT_PREFIX}${opensslRandBase64OneLine()}`;
		return { plaintext, hash: sha256Hex(plaintext), prefix: plaintext.slice(0, API_KEY_PREFIX_LENGTH) };
	}
}
