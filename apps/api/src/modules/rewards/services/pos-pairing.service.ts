import { Injectable, NotFoundException } from "@nestjs/common";

import { PosTerminalIdSchema, type PosPairedTerminal, type PosPairTerminalInput } from "@workspace/shared";

import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { MerchantApiKeyRepository } from "../repositories/merchant-api-key.repository";
import { MerchantTerminalRepository } from "../repositories/merchant-terminal.repository";
import { RewardAuditLogRepository } from "../repositories/reward-audit-log.repository";
import { sha256Hex } from "../../../common/crypto/sha256";
import { RewardCodeHasher } from "../crypto/reward-code-hasher";
import { assertOrganizationOperating } from "../policies/organization-operating-status.policy";
import { generateApiKeyPlaintext } from "../utils/reward-crypto.util";
import { API_KEY_PREFIX_LENGTH } from "./merchant-api-key.service";

/** Unknown, expired and already-used codes all look the same to the caller. */
function pairingCodeInvalid(): NotFoundException {
	return new NotFoundException({ message: "This pairing code is invalid or has expired", error: "PAIRING_CODE_INVALID" });
}

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
		private readonly codeHasher: RewardCodeHasher,
		private readonly tenantTx: TenantTransactionService,
	) {}

	public async pair(input: PosPairTerminalInput): Promise<PosPairedTerminal> {
		const plaintext = generateApiKeyPlaintext();

		// No API key exists yet, so there is no principal to scope by: the one-time code is the authorization,
		// and the whole exchange runs as the named `pos.terminal.pair` system operation.
		return this.tenantTx.withSystemOperation(
			{ operation: "pos.terminal.pair", reason: "Pair a POS terminal with its one-time code", actorUserId: null },
			async (tx): Promise<PosPairedTerminal> => {
				const now = Date.now();
				const terminal = await this.terminalRepository.consumePairingCode(this.codeHasher.lookupCandidates(input.pairingCode), now, tx);
				if (terminal === null) {
					throw pairingCodeInvalid();
				}
				// A suspended / deactivated merchant cannot bring a till online (the transaction rolls back, so the code survives a reactivation).
				assertOrganizationOperating(terminal.organization);
				// The member who issued this code is who brings the till online: the key is minted in their name.
				// A live code without an issuer predates issuer tracking — it is refused, never attributed to someone else.
				const issuedByUserId = terminal.pairingCodeIssuedByUserId;
				if (issuedByUserId === null) {
					throw pairingCodeInvalid();
				}

				const key = await this.apiKeyRepository.create(
					{
						organizationId: terminal.organizationId,
						locationId: terminal.locationId,
						name: terminal.label ?? terminal.terminalId,
						keyHash: sha256Hex(plaintext),
						keyPrefix: plaintext.slice(0, API_KEY_PREFIX_LENGTH),
						// A till's key may only call the POS redemption routes, never the organization API.
						scope: "POS",
						createdByUserId: issuedByUserId,
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
						actorUserId: issuedByUserId,
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
			},
		);
	}
}
