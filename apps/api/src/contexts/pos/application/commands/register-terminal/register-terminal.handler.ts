import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { epochMs, MERCHANT_CAPABILITY, POS_PAIRING_CODE_TTL_MS, type EpochMs, type MerchantTerminalPairing } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { MerchantAccessPort } from "../../../../../platform/application/ports/authorization.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { MERCHANT_ACCESS } from "../../../../tenancy/public-api";
import { TenantTerminal } from "../../../domain/aggregates/tenant-terminal.aggregate";
import { TerminalIdUnavailableError, TerminalStoreNotActiveError } from "../../../domain/errors/pos.errors";
import { actingInTenant, actingMemberId } from "../../acting-member";
import type { PosScope } from "../../pos-scope";
import type { PosCredentialsPort } from "../../ports/pos-credentials.port";
import { POS_CREDENTIALS, POS_ID_GENERATOR, POS_UNIT_OF_WORK, type PosIdGenerator } from "../../ports/pos.tokens";
import { RegisterTerminalCommand } from "./register-terminal.command";

/** Fresh terminal ids tried before giving up (a clash among ~10¹² values is already vanishingly rare). */
const TERMINAL_ID_ATTEMPTS = 3;

/**
 * Registers a till at one of the member's stores, with its first pairing code (shown once). Same
 * capability as API keys (`merchant:manage_api_keys`): a terminal is how a key reaches a till. A live
 * till of the tenant with the same terminal id is refused by the database (409 `TERMINAL_ID_TAKEN`).
 * The store is locked `FOR SHARE` first: a concurrent store closure either committed (409
 * `TERMINAL_STORE_NOT_ACTIVE`) or waits for this till and then removes it with the store's others (D27).
 */
@CommandHandler(RegisterTerminalCommand)
export class RegisterTerminalHandler implements ICommandHandler<RegisterTerminalCommand, MerchantTerminalPairing> {
	public constructor(
		@Inject(POS_UNIT_OF_WORK) private readonly uow: UnitOfWork<PosScope>,
		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		@Inject(POS_CREDENTIALS) private readonly credentials: PosCredentialsPort,
		@Inject(POS_ID_GENERATOR) private readonly ids: PosIdGenerator,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: RegisterTerminalCommand): Promise<MerchantTerminalPairing> {
		const { actor, input } = command;
		const memberId = actingMemberId(actor);
		await this.merchantAccess.assertCapability(actor, { tenantId: input.tenantId, capability: MERCHANT_CAPABILITY.manageApiKeys, locationId: input.locationId });
		const tenant = actingInTenant(actor, input.tenantId);
		const secret = this.credentials.newPairingCode();
		return this.uow.run(tenant, async (scope: PosScope): Promise<MerchantTerminalPairing> => {
			if (!(await scope.posSettings.lockOpenStore(input.tenantId, input.locationId))) {
				throw new TerminalStoreNotActiveError();
			}
			const now = this.clock.now();
			const expiresAt: EpochMs = epochMs(now + POS_PAIRING_CODE_TTL_MS);
			const terminalId = input.terminalId ?? (await this.freeTerminalId(scope, input.tenantId));
			const terminal = TenantTerminal.register({
				id: this.ids.next(),
				tenantId: input.tenantId,
				locationId: input.locationId,
				terminalId,
				name: input.name,
				createdByUserId: memberId,
				pairingCode: { hash: secret.hash, expiresAt, issuedByUserId: memberId, issuedAt: now },
			});
			await scope.terminals.add(terminal);
			await scope.rewardAudit.append({
				tenantId: input.tenantId,
				actorUserId: memberId,
				action: "merchant.terminal_created",
				metadata: { terminalId: terminal.id, terminalLabel: terminalId, locationId: input.locationId },
			});
			return { terminal: await scope.terminalViews.getSummary(terminal.id, now), pairingCode: secret.code, pairingCodeExpiresAt: expiresAt };
		});
	}

	private async freeTerminalId(scope: PosScope, tenantId: string): Promise<string> {
		for (let attempt = 0; attempt < TERMINAL_ID_ATTEMPTS; attempt += 1) {
			const candidate = this.credentials.newTerminalId();
			if (!(await scope.terminals.terminalIdExists(tenantId, candidate))) {
				return candidate;
			}
		}
		throw new TerminalIdUnavailableError();
	}
}
