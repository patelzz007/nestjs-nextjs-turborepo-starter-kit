import { Injectable, NotFoundException } from "@nestjs/common";

import { PosTerminalIdSchema, type PosPairedTerminal, type PosPairTerminalInput } from "@workspace/shared";

import { MerchantApiKeyRepository } from "../repositories/merchant-api-key.repository";
import { MerchantTerminalRepository } from "../repositories/merchant-terminal.repository";
import { RewardAuditLogRepository } from "../repositories/reward-audit-log.repository";
import { generateApiKeyPlaintext, sha256Hex } from "../utils/reward-crypto.util";

/** Unknown, expired and already-used codes all look the same to the caller. */
function pairingCodeInvalid(): NotFoundException {
	return new NotFoundException({ message: "This pairing code is invalid or has expired", error: "PAIRING_CODE_INVALID" });
}

/** Characters of the plaintext key kept as its display prefix (same as manually created keys). */
const API_KEY_PREFIX_LENGTH = 16;

/**
 * `POST /pos/terminals/pair` — a till exchanges the one-time code shown in the
 * merchant console for its own API key, bound to that terminal and its store.
 *
 * One transaction: consume the code (single use, race-safe) → mint the key →
 * revoke the terminal's previous key (re-pairing rotates it) → bind. Unknown,
 * expired and already-used codes all fail the same way, so the endpoint is not
 * an oracle for which codes exist.
 */
@Injectable()
export class PosPairingService {
	public constructor(
		private readonly terminalRepository: MerchantTerminalRepository,
		private readonly apiKeyRepository: MerchantApiKeyRepository,
		private readonly auditLogRepository: RewardAuditLogRepository,
	) {}

	public async pair(input: PosPairTerminalInput): Promise<PosPairedTerminal> {
		const plaintext = generateApiKeyPlaintext();

		return this.terminalRepository.transaction(async (tx): Promise<PosPairedTerminal> => {
			const now = Date.now();
			const terminal = await this.terminalRepository.consumePairingCode(sha256Hex(input.pairingCode), now, tx);
			if (terminal === null) {
				throw pairingCodeInvalid();
			}
			// A pairing code is only ever issued by a member, who is recorded as the terminal's creator.
			const createdByUserId = terminal.createdByUserId;
			if (createdByUserId === null) {
				throw pairingCodeInvalid();
			}

			const key = await this.apiKeyRepository.create(
				{
					organizationId: terminal.organizationId,
					locationId: terminal.locationId,
					name: terminal.label ?? terminal.terminalId,
					keyHash: sha256Hex(plaintext),
					keyPrefix: plaintext.slice(0, API_KEY_PREFIX_LENGTH),
					createdByUserId,
				},
				tx,
			);
			if (terminal.apiKeyId !== null) {
				await this.apiKeyRepository.revoke(terminal.apiKeyId, now, tx);
			}
			await this.terminalRepository.bindApiKey(terminal.id, key.id, now, tx);
			await this.auditLogRepository.create(
				{
					organizationId: terminal.organizationId,
					action: "pos.terminal_paired",
					metadata: { terminalId: terminal.id, apiKeyId: key.id, replacedApiKeyId: terminal.apiKeyId },
				},
				tx,
			);

			return {
				apiKey: plaintext,
				terminalId: PosTerminalIdSchema.parse(terminal.terminalId),
				terminalName: terminal.label ?? terminal.terminalId,
				organization: { slug: terminal.organization.slug, displayName: terminal.organization.displayName },
				location: { id: terminal.locationId, name: terminal.location.name },
			};
		});
	}
}
