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
	type MerchantTerminalStatusSummary,
	type MerchantTerminalStatusSummaryQuery,
	type MerchantTerminalSummary,
	type PaginatedServiceResult,
} from "@workspace/shared";

import { mapListResult, toPaginatedServiceResult } from "../../../platform/persistence/list-page";
import { isUniqueViolationOf } from "../../../platform/persistence/unique-violation";
import { isLocationInScope } from "../utils/merchant-location-scope.util";
import type { MerchantLocationScope } from "../types/merchant-location-scope";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { OrganizationRewardAuthService, type ResolvedOrganizationRewardContext } from "../../organization/services/organization-reward-auth.service";
import { MerchantApiKeyRepository } from "../repositories/merchant-api-key.repository";
import { MerchantTerminalRepository, type OrganizationTerminalRow } from "../repositories/merchant-terminal.repository";
import { RewardAuditLogRepository } from "../repositories/reward-audit-log.repository";
import { generatePairingCode, generateTerminalId, toTerminalSummary } from "../utils/pos-terminal.util";
import { RewardCodeHasher } from "../crypto/reward-code-hasher";
import { MerchantContextService } from "./merchant-context.service";

/** The tenant transaction client (derived — the transaction service does not export it). */
type TenantTx = Parameters<Parameters<TenantTransactionService["withTenantTransaction"]>[1]>[0];

/** Fresh terminal ids tried before giving up (a clash among ~10¹² values is already vanishingly rare). */
const TERMINAL_ID_ATTEMPTS = 3;

/** The partial unique index on `(organization_id, terminal_id)` among live terminals. */
const LIVE_TERMINAL_ID_INDEX = "organization_terminals_organization_id_terminal_id_key";

/**
 * POS terminal registration for the merchant console. Same capability as API
 * keys (`merchant:manage_api_keys`): a terminal is how a key reaches a till.
 * Store scope is enforced here, explicitly, for every route: a store-limited
 * member lists, re-pairs and removes only its own stores' tills (another
 * store's till is 404). RLS (`organization_terminals_tenant_acl`) is the second
 * line of defence, not the only one.
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
		private readonly codeHasher: RewardCodeHasher,
	) {}

	public async list(userId: string, orgSlug: string, query: MerchantTerminalListQuery): Promise<PaginatedServiceResult<MerchantTerminalSummary>> {
		const resolved = await this.authorize(userId, orgSlug);
		const scope = await this.merchantContext.resolveUserLocationScope(userId, orgSlug, query.locationId);

		const result = await this.inTenant(userId, resolved, "merchant.terminals.list", async (tx) =>
			this.terminalRepository.listByOrgId(resolved.organizationId, scope, query, tx),
		);
		const now = Date.now();
		return toPaginatedServiceResult(
			mapListResult(result, (row) => toTerminalSummary(row, now)),
			query,
		);
	}

	/** Live terminals per status and the stores they cover — within the member's store scope, like {@link list}. */
	public async summary(userId: string, orgSlug: string, query: MerchantTerminalStatusSummaryQuery): Promise<MerchantTerminalStatusSummary> {
		const resolved = await this.authorize(userId, orgSlug);
		const scope = await this.merchantContext.resolveUserLocationScope(userId, orgSlug, query.locationId);
		const counts = await this.inTenant(userId, resolved, "merchant.terminals.summary", async (tx) =>
			this.terminalRepository.countStatusSummary(resolved.organizationId, scope, Date.now(), tx),
		);
		return {
			total: counts.total,
			byStatus: { AWAITING_PAIRING: counts.awaitingPairing, ACTIVE: counts.active, UNPAIRED: counts.total - counts.awaitingPairing - counts.active },
			storesWithTerminals: counts.storesWithTerminals,
		};
	}

	/** One live terminal; another store's till (for a store-limited member) or another organization's is 404. */
	public async get(userId: string, orgSlug: string, id: string): Promise<MerchantTerminalSummary> {
		const resolved = await this.authorize(userId, orgSlug);
		const scope = await this.merchantContext.resolveUserLocationScope(userId, orgSlug, undefined);
		const terminal = await this.inTenant(userId, resolved, "merchant.terminals.get", async (tx) =>
			this.terminalRepository.findLiveByIdAndOrg(id, resolved.organizationId, tx),
		);
		return toTerminalSummary(requireInScope(terminal, scope), Date.now());
	}

	/** Registers a till at one store and returns its first pairing code (shown once). */
	public async create(userId: string, orgSlug: string, input: MerchantCreateTerminalInput): Promise<MerchantTerminalPairing> {
		const resolved = await this.authorize(userId, orgSlug);
		await this.merchantContext.assertAccessibleLocationForUser(userId, orgSlug, input.locationId);

		const pairingCode = generatePairingCode();
		const issuedAt = Date.now();
		const expiresAt = issuedAt + POS_PAIRING_CODE_TTL_MS;

		let terminal: OrganizationTerminalRow;
		try {
			terminal = await this.inTenant(userId, resolved, "merchant.terminals.create", async (tx) => {
				const terminalId = input.terminalId ?? (await this.freeTerminalId(resolved.organizationId, tx));
				const created = await this.terminalRepository.create(
					{
						organizationId: resolved.organizationId,
						locationId: input.locationId,
						terminalId,
						name: input.name,
						createdByUserId: userId,
						pairingCodeHash: this.codeHasher.hash(pairingCode),
						pairingCodeExpiresAt: expiresAt,
						pairingCodeIssuedAt: issuedAt,
					},
					tx,
				);
				await this.audit(tx, resolved.organizationId, userId, "merchant.terminal_created", {
					terminalId: created.id,
					terminalLabel: terminalId,
					locationId: input.locationId,
				});
				return created;
			});
		} catch (error) {
			// Another live till of this organization already uses the label (the database decides, race-free).
			if (error instanceof Error && isUniqueViolationOf(error, LIVE_TERMINAL_ID_INDEX)) {
				throw new ConflictException({ message: "Another terminal already uses this terminal id", error: "TERMINAL_ID_TAKEN" });
			}
			throw error;
		}

		return this.toPairing(terminal, pairingCode, expiresAt);
	}

	/** Issues a new code — for a till that never paired, whose code expired, or that must be re-paired (its key rotates when the code is used). */
	public async issuePairingCode(userId: string, orgSlug: string, id: string): Promise<MerchantTerminalPairing> {
		const resolved = await this.authorize(userId, orgSlug);
		const scope = await this.merchantContext.resolveUserLocationScope(userId, orgSlug, undefined);
		const pairingCode = generatePairingCode();
		const issuedAt = Date.now();
		const expiresAt = issuedAt + POS_PAIRING_CODE_TTL_MS;

		const terminal = await this.inTenant(userId, resolved, "merchant.terminals.pairing_code", async (tx) => {
			const existing = requireInScope(await this.terminalRepository.findLiveByIdAndOrg(id, resolved.organizationId, tx), scope);
			const updated = await this.terminalRepository.setPairingCode(
				existing.id,
				{ pairingCodeHash: this.codeHasher.hash(pairingCode), pairingCodeExpiresAt: expiresAt, issuedByUserId: userId, issuedAt },
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
		const scope = await this.merchantContext.resolveUserLocationScope(userId, orgSlug, undefined);

		await this.inTenant(userId, resolved, "merchant.terminals.remove", async (tx) => {
			// Locked: a pairing racing this removal cannot leave a live key bound to a deleted till.
			const existing = requireInScope(await this.terminalRepository.findLiveByIdAndOrgForUpdate(id, resolved.organizationId, tx), scope);
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

/** The terminal, if it exists and lies within the member's stores; another store's till is reported as not found. */
function requireInScope(terminal: OrganizationTerminalRow | null, scope: MerchantLocationScope): OrganizationTerminalRow {
	if (terminal === null || !isLocationInScope(scope, terminal.locationId)) {
		throw new NotFoundException({ message: "Terminal not found", error: "TERMINAL_NOT_FOUND" });
	}
	return terminal;
}
