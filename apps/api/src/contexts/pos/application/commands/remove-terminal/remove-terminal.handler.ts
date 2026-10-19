import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { MERCHANT_CAPABILITY, type OkResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { MerchantAccessPort } from "../../../../../platform/application/ports/authorization.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { MERCHANT_ACCESS } from "../../../../organizations/public-api";
import { TerminalNotFoundError } from "../../../domain/errors/pos.errors";
import { actingInOrganization, actingMemberId } from "../../acting-member";
import type { PosScope } from "../../pos-scope";
import { POS_UNIT_OF_WORK } from "../../ports/pos.tokens";
import { isWithinGrant } from "../../services/store-scope";
import { RemoveTerminalCommand } from "./remove-terminal.command";

/**
 * Soft-deletes the till and revokes its key in the same transaction, so it stops working at once. The
 * terminal row is locked first: a pairing racing the removal either finished (and its new key is the
 * one revoked here) or waits and then finds the terminal deleted.
 */
@CommandHandler(RemoveTerminalCommand)
export class RemoveTerminalHandler implements ICommandHandler<RemoveTerminalCommand, OkResponse> {
	public constructor(
		@Inject(POS_UNIT_OF_WORK) private readonly uow: UnitOfWork<PosScope>,
		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: RemoveTerminalCommand): Promise<OkResponse> {
		const { actor, input } = command;
		const memberId = actingMemberId(actor);
		const grant = await this.merchantAccess.assertCapability(actor, { organizationId: input.organizationId, capability: MERCHANT_CAPABILITY.manageApiKeys });
		const tenant = actingInOrganization(actor, input.organizationId);
		await this.uow.run(tenant, async (scope: PosScope): Promise<void> => {
			const terminal = await scope.terminals.lockLive(input.terminalRowId, input.organizationId);
			if (terminal === null || !isWithinGrant(grant, terminal.locationId)) {
				throw new TerminalNotFoundError();
			}
			const now = this.clock.now();
			const boundKeyId = terminal.remove(memberId, now);
			await scope.terminals.save(terminal);
			const boundKey = boundKeyId === null ? null : await scope.apiKeys.findById(boundKeyId);
			if (boundKey?.revoke(now) === true) {
				await scope.apiKeys.save(boundKey);
			}
			await scope.rewardAudit.append({
				organizationId: input.organizationId,
				actorUserId: memberId,
				action: "merchant.terminal_removed",
				metadata: { terminalId: terminal.id, revokedApiKeyId: boundKeyId },
			});
		});
		return { ok: true };
	}
}
