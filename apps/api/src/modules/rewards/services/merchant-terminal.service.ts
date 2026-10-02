import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import {
	EpochMsSchema,
	MERCHANT_CAPABILITY,
	POS_PAIRING_CODE_TTL_MS,
	type MerchantCreateTerminalInput,
	type MerchantTerminalListQuery,
	type MerchantTerminalPairing,
	type MerchantTerminalSettings,
	type MerchantTerminalSummary,
	type PaginatedServiceResult,
} from "@workspace/shared";

import { mapListResult, toPaginatedServiceResult } from "../../../platform/persistence/list-page";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { OrganizationRewardAuthService, type ResolvedOrganizationRewardContext } from "../../organization/services/organization-reward-auth.service";
import { MerchantApiKeyRepository } from "../repositories/merchant-api-key.repository";
import { MerchantTerminalRepository, type OrganizationTerminalRow } from "../repositories/merchant-terminal.repository";
import { RewardAuditLogRepository } from "../repositories/reward-audit-log.repository";
import { generatePairingCode, generateTerminalId, toTerminalSummary } from "../utils/pos-terminal.util";
import { sha256Hex } from "../utils/reward-crypto.util";
import { MerchantContextService } from "./merchant-context.service";

/** The tenant transaction client (derived — the transaction service does not export it). */
type TenantTx = Parameters<Parameters<TenantTransactionService["withTenantTransaction"]>[1]>[0];

/** Fresh terminal ids tried before giving up (a clash among ~10¹² values is already vanishingly rare). */
const TERMINAL_ID_ATTEMPTS = 3;

/**
 * POS terminal registration for the merchant console. Same capability as API
 * keys (`merchant:manage_api_keys`): a terminal is how a key reaches a till.
 * Every query runs in the member's tenant transaction, so RLS
 * (`organization_terminals_tenant_acl`) already hides other stores' tills from
 * store-scoped members; writes to a specific store are checked explicitly too.
 */
@Injectable()
export class MerchantTerminalService {
	public constructor(
		private readonly terminalRepository: MerchantTerminalRepository,
		private readonly apiKeyRepository: MerchantApiKeyRepository,
		private readonly auditLogRepository: RewardAuditLogRepository,
		private readonly merchantContext: MerchantContextService,
		private readonly organizationRewardAuth: OrganizationRewardAuthService,
		private readonly tenantTx: TenantTransactionService,
	) {}

	public async list(userId: string, orgSlug: string, query: MerchantTerminalListQuery): Promise<PaginatedServiceResult<MerchantTerminalSummary>> {
		const resolved = await this.authorize(userId, orgSlug);
		const locationId = query.locationId;
		if (locationId !== undefined) {
			await this.merchantContext.assertAccessibleLocationForUser(userId, orgSlug, locationId);
		}

		const result = await this.inTenant(userId, resolved, "merchant.terminals.list", async (tx) =>
			this.terminalRepository.listByOrgId(resolved.organizationId, locationId, query, tx),
		);
		const now = Date.now();
		return toPaginatedServiceResult(
			mapListResult(result, (row) => toTerminalSummary(row, now)),
			query,
		);
	}

	/** Registers a till at one store and returns its first pairing code (shown once). */
	public async create(userId: string, orgSlug: string, input: MerchantCreateTerminalInput): Promise<MerchantTerminalPairing> {
		const resolved = await this.authorize(userId, orgSlug);
		await this.merchantContext.assertAccessibleLocationForUser(userId, orgSlug, input.locationId);

		const pairingCode = generatePairingCode();
		const expiresAt = Date.now() + POS_PAIRING_CODE_TTL_MS;

		const terminal = await this.inTenant(userId, resolved, "merchant.terminals.create", async (tx) => {
			const terminalId = await this.freeTerminalId(resolved.organizationId, tx);
			const created = await this.terminalRepository.create(
				{
					organizationId: resolved.organizationId,
					locationId: input.locationId,
					terminalId,
					name: input.name,
					createdByUserId: userId,
					pairingCodeHash: sha256Hex(pairingCode),
					pairingCodeExpiresAt: expiresAt,
				},
				tx,
			);
			await this.audit(tx, resolved.organizationId, userId, "merchant.terminal_created", { terminalId: created.id, terminalLabel: terminalId, locationId: input.locationId });
			return created;
		});

		return this.toPairing(terminal, pairingCode, expiresAt);
	}

	/** Issues a new code — for a till that never paired, whose code expired, or that must be re-paired (its key rotates when the code is used). */
	public async issuePairingCode(userId: string, orgSlug: string, id: string): Promise<MerchantTerminalPairing> {
		const resolved = await this.authorize(userId, orgSlug);
		const pairingCode = generatePairingCode();
		const expiresAt = Date.now() + POS_PAIRING_CODE_TTL_MS;

		const terminal = await this.inTenant(userId, resolved, "merchant.terminals.pairing_code", async (tx) => {
			const existing = await this.requireTerminal(id, resolved.organizationId, tx);
			const updated = await this.terminalRepository.setPairingCode(
				existing.id,
				{ pairingCodeHash: sha256Hex(pairingCode), pairingCodeExpiresAt: expiresAt, issuedByUserId: userId, createdByUserId: existing.createdByUserId },
				tx,
			);
			await this.audit(tx, resolved.organizationId, userId, "merchant.terminal_pairing_code_issued", { terminalId: existing.id });
			return updated;
		});

		return this.toPairing(terminal, pairingCode, expiresAt);
	}

	/** Soft-deletes the till and revokes its key in the same transaction — it stops working immediately. */
	public async remove(userId: string, orgSlug: string, id: string): Promise<{ ok: true }> {
		const resolved = await this.authorize(userId, orgSlug);

		await this.inTenant(userId, resolved, "merchant.terminals.remove", async (tx) => {
			const existing = await this.requireTerminal(id, resolved.organizationId, tx);
			const now = Date.now();
			await this.terminalRepository.softDelete(existing.id, userId, now, tx);
			if (existing.apiKeyId !== null && existing.apiKey?.revokedAt === null) {
				await this.apiKeyRepository.revoke(existing.apiKeyId, now, tx);
			}
			await this.audit(tx, resolved.organizationId, userId, "merchant.terminal_removed", { terminalId: existing.id, revokedApiKeyId: existing.apiKeyId });
		});

		return { ok: true };
	}

	public async getSettings(userId: string, orgSlug: string): Promise<MerchantTerminalSettings> {
		const resolved = await this.authorize(userId, orgSlug);
		const requireRegisteredTerminals = await this.inTenant(userId, resolved, "merchant.terminals.settings", async (tx) =>
			this.terminalRepository.getRequireRegisteredTerminals(resolved.organizationId, tx),
		);
		return { requireRegisteredTerminals: requireRegisteredTerminals ?? false };
	}

	public async updateSettings(userId: string, orgSlug: string, settings: MerchantTerminalSettings): Promise<MerchantTerminalSettings> {
		const resolved = await this.authorize(userId, orgSlug);
		await this.inTenant(userId, resolved, "merchant.terminals.settings_update", async (tx) => {
			const updated = await this.terminalRepository.setRequireRegisteredTerminals(resolved.organizationId, settings.requireRegisteredTerminals, tx);
			if (updated === 0) {
				throw new NotFoundException({ message: "Merchant profile not found", error: "MERCHANT_PROFILE_NOT_FOUND" });
			}
			await this.audit(tx, resolved.organizationId, userId, "merchant.terminal_settings_updated", { requireRegisteredTerminals: settings.requireRegisteredTerminals });
		});
		return settings;
	}

	private async authorize(userId: string, orgSlug: string): Promise<ResolvedOrganizationRewardContext> {
		return this.organizationRewardAuth.requireCapabilityForSlug(userId, orgSlug, MERCHANT_CAPABILITY.manageApiKeys);
	}

	private async inTenant<T>(userId: string, resolved: ResolvedOrganizationRewardContext, purpose: string, work: (tx: TenantTx) => Promise<T>): Promise<T> {
		return this.tenantTx.withTenantTransaction({ userId, organizationId: resolved.organizationId, purpose, policyVersion: resolved.policyVersion }, work);
	}

	/** Not found also covers another store's till for a store-scoped member (RLS hides the row). */
	private async requireTerminal(id: string, organizationId: string, tx: TenantTx): Promise<OrganizationTerminalRow> {
		const terminal = await this.terminalRepository.findLiveByIdAndOrg(id, organizationId, tx);
		if (terminal === null) {
			throw new NotFoundException({ message: "Terminal not found", error: "TERMINAL_NOT_FOUND" });
		}
		return terminal;
	}

	private async freeTerminalId(organizationId: string, tx: TenantTx): Promise<string> {
		for (let attempt = 0; attempt < TERMINAL_ID_ATTEMPTS; attempt += 1) {
			const candidate = generateTerminalId();
			if (!(await this.terminalRepository.terminalIdExists(organizationId, candidate, tx))) {
				return candidate;
			}
		}
		throw new ConflictException({ message: "Could not allocate a terminal id, please retry", error: "TERMINAL_ID_UNAVAILABLE" });
	}

	private async audit(tx: TenantTx, organizationId: string, actorUserId: string, action: string, metadata: Prisma.InputJsonObject): Promise<void> {
		await this.auditLogRepository.create({ organizationId, actorUserId, action, metadata }, tx);
	}

	private toPairing(terminal: OrganizationTerminalRow, pairingCode: MerchantTerminalPairing["pairingCode"], expiresAt: number): MerchantTerminalPairing {
		return { terminal: toTerminalSummary(terminal, Date.now()), pairingCode, pairingCodeExpiresAt: EpochMsSchema.parse(expiresAt) };
	}
}
