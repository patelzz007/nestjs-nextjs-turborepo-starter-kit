import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { epochMs, MERCHANT_CAPABILITY, POS_PAIRING_CODE_TTL_MS, type MerchantTerminalPairing } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { MerchantAccessPort } from "../../../../../platform/application/ports/authorization.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { MERCHANT_ACCESS } from "../../../../tenancy/public-api";
import { TerminalNotFoundError } from "../../../domain/errors/pos.errors";
import { actingInTenant, actingMemberId } from "../../acting-member";
import type { PosScope } from "../../pos-scope";
import type { PosCredentialsPort } from "../../ports/pos-credentials.port";
import { POS_CREDENTIALS, POS_UNIT_OF_WORK } from "../../ports/pos.tokens";
import { isWithinGrant } from "../../services/store-scope";
import { IssuePairingCodeCommand } from "./issue-pairing-code.command";

/**
 * Issues a fresh pairing code (replacing any live one) under the terminal's row lock (D33): two
 * concurrent issues run one after the other, so the code the last response shows is the one stored,
 * and only it pairs. The till's current key keeps working until the new code is used.
 */
@CommandHandler(IssuePairingCodeCommand)
export class IssuePairingCodeHandler implements ICommandHandler<IssuePairingCodeCommand, MerchantTerminalPairing> {
	public constructor(
		@Inject(POS_UNIT_OF_WORK) private readonly uow: UnitOfWork<PosScope>,
		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		@Inject(POS_CREDENTIALS) private readonly credentials: PosCredentialsPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: IssuePairingCodeCommand): Promise<MerchantTerminalPairing> {
		const { actor, input } = command;
		const memberId = actingMemberId(actor);
		const grant = await this.merchantAccess.assertCapability(actor, { tenantId: input.tenantId, capability: MERCHANT_CAPABILITY.manageApiKeys });
		const tenant = actingInTenant(actor, input.tenantId);
		const secret = this.credentials.newPairingCode();
		return this.uow.run(tenant, async (scope: PosScope): Promise<MerchantTerminalPairing> => {
			const terminal = await scope.terminals.lockLive(input.terminalRowId, input.tenantId);
			if (terminal === null || !isWithinGrant(grant, terminal.locationId)) {
				throw new TerminalNotFoundError();
			}
			const now = this.clock.now();
			const expiresAt = epochMs(now + POS_PAIRING_CODE_TTL_MS);
			terminal.issuePairingCode({ hash: secret.hash, expiresAt, issuedByUserId: memberId, issuedAt: now });
			await scope.terminals.save(terminal);
			await scope.rewardAudit.append({
				tenantId: input.tenantId,
				actorUserId: memberId,
				action: "merchant.terminal_pairing_code_issued",
				metadata: { terminalId: terminal.id },
			});
			return { terminal: await scope.terminalViews.getSummary(terminal.id, now), pairingCode: secret.code, pairingCodeExpiresAt: expiresAt };
		});
	}
}
