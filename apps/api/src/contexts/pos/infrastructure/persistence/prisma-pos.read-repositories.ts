import type { Prisma } from "@prisma/client";
import {
	epochMs,
	type EpochMs,
	type MerchantApiKeyListQuery,
	type MerchantApiKeySummary,
	type MerchantRedemptionListItem,
	type MerchantRedemptionListQuery,
	type MerchantTerminalListQuery,
	type MerchantTerminalStatusSummary,
	type MerchantTerminalSummary,
	type PaginatedServiceResult,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { MerchantAccessGrant } from "../../../../platform/application/ports/authorization.port";
import { fetchListPage, mapListResult, toPaginatedServiceResult } from "../../../../platform/infrastructure/persistence/list-page";
import { timestampIdKeyset, type ListKeyset } from "../../../../platform/infrastructure/persistence/list-query/keyset-cursor";
import type { PrismaReadExecutor } from "../../../../platform/infrastructure/unit-of-work/prisma-read-executor";
import type { ApiKeyReadPort, RedemptionReadPort, TerminalReadPort } from "../../application/ports/pos-read.port";
import {
	buildApiKeyListOrder,
	buildApiKeyListWhere,
	buildRedemptionListOrder,
	buildRedemptionListWhere,
	buildTerminalListOrder,
	buildTerminalListWhere,
} from "./pos-list-queries";
import { TERMINAL_SUMMARY_INCLUDE, terminalStatusWhere, toTerminalSummary, type TerminalSummaryRow } from "./terminal-row.mapper";

/** Keyset for the default terminal order (`createdAt desc, id desc`). */
const TERMINAL_LIST_KEYSET: ListKeyset<TerminalSummaryRow, Prisma.OrganizationTerminalWhereInput> = timestampIdKeyset(
	(row: TerminalSummaryRow) => ({ at: Number(row.createdAt), id: row.id }),
	({ at, id }): Prisma.OrganizationTerminalWhereInput => ({ OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: id } }] }),
);

/** Live terminals of the organization within the caller's granted stores, read under the caller's RLS session. */
export class PrismaTerminalReadRepository implements TerminalReadPort {
	public constructor(private readonly reads: PrismaReadExecutor<Prisma.TransactionClient>) {}

	public async list(
		actor: ActorContext,
		grant: MerchantAccessGrant,
		query: MerchantTerminalListQuery,
		now: EpochMs,
	): Promise<PaginatedServiceResult<MerchantTerminalSummary>> {
		return this.reads.read(actor, async (db: Prisma.TransactionClient): Promise<PaginatedServiceResult<MerchantTerminalSummary>> => {
			const page = await fetchListPage(query, {
				where: buildTerminalListWhere(grant),
				order: buildTerminalListOrder(query),
				keyset: TERMINAL_LIST_KEYSET,
				and: (left: Prisma.OrganizationTerminalWhereInput, right: Prisma.OrganizationTerminalWhereInput): Prisma.OrganizationTerminalWhereInput => ({ AND: [left, right] }),
				count: (where: Prisma.OrganizationTerminalWhereInput): Promise<number> => db.organizationTerminal.count({ where }),
				findMany: (args): Promise<TerminalSummaryRow[]> => db.organizationTerminal.findMany({ ...args, include: TERMINAL_SUMMARY_INCLUDE }),
			});
			return toPaginatedServiceResult(
				mapListResult(page, (row: TerminalSummaryRow): MerchantTerminalSummary => toTerminalSummary(row, now)),
				query,
			);
		});
	}

	public async summary(actor: ActorContext, grant: MerchantAccessGrant, now: EpochMs): Promise<MerchantTerminalStatusSummary> {
		return this.reads.read(actor, async (db: Prisma.TransactionClient): Promise<MerchantTerminalStatusSummary> => {
			const live = buildTerminalListWhere(grant);
			const total = await db.organizationTerminal.count({ where: live });
			const awaitingPairing = await db.organizationTerminal.count({ where: { AND: [live, terminalStatusWhere("AWAITING_PAIRING", now)] } });
			const active = await db.organizationTerminal.count({ where: { AND: [live, terminalStatusWhere("ACTIVE", now)] } });
			const stores = await db.organizationTerminal.groupBy({ by: ["locationId"], where: live });
			return {
				total,
				byStatus: { AWAITING_PAIRING: awaitingPairing, ACTIVE: active, UNPAIRED: total - awaitingPairing - active },
				storesWithTerminals: stores.length,
			};
		});
	}

	public async find(actor: ActorContext, organizationId: string, id: string, now: EpochMs): Promise<MerchantTerminalSummary | null> {
		return this.reads.read(actor, async (db: Prisma.TransactionClient): Promise<MerchantTerminalSummary | null> => {
			const row = await db.organizationTerminal.findFirst({ where: { id, organizationId, isDeleted: false }, include: TERMINAL_SUMMARY_INCLUDE });
			return row === null ? null : toTerminalSummary(row, now);
		});
	}
}

const API_KEY_LIST_INCLUDE = { location: { select: { name: true } } } satisfies Prisma.OrganizationApiKeyInclude;

type ApiKeyListRow = Prisma.OrganizationApiKeyGetPayload<{ include: typeof API_KEY_LIST_INCLUDE }>;

/** Keyset for the default key order (`createdAt desc, id desc`). */
const API_KEY_LIST_KEYSET: ListKeyset<ApiKeyListRow, Prisma.OrganizationApiKeyWhereInput> = timestampIdKeyset(
	(row: ApiKeyListRow) => ({ at: Number(row.createdAt), id: row.id }),
	({ at, id }): Prisma.OrganizationApiKeyWhereInput => ({ OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: id } }] }),
);

function epochOrNull(value: bigint | null): EpochMs | null {
	return value === null ? null : epochMs(Number(value));
}

/** Live keys of the organization within the caller's granted stores, read under the caller's RLS session. */
export class PrismaApiKeyReadRepository implements ApiKeyReadPort {
	public constructor(private readonly reads: PrismaReadExecutor<Prisma.TransactionClient>) {}

	public async list(actor: ActorContext, grant: MerchantAccessGrant, query: MerchantApiKeyListQuery): Promise<PaginatedServiceResult<MerchantApiKeySummary>> {
		return this.reads.read(actor, async (db: Prisma.TransactionClient): Promise<PaginatedServiceResult<MerchantApiKeySummary>> => {
			const page = await fetchListPage(query, {
				where: buildApiKeyListWhere(grant, query),
				order: buildApiKeyListOrder(query),
				keyset: API_KEY_LIST_KEYSET,
				and: (left: Prisma.OrganizationApiKeyWhereInput, right: Prisma.OrganizationApiKeyWhereInput): Prisma.OrganizationApiKeyWhereInput => ({ AND: [left, right] }),
				count: (where: Prisma.OrganizationApiKeyWhereInput): Promise<number> => db.organizationApiKey.count({ where }),
				findMany: (args): Promise<ApiKeyListRow[]> => db.organizationApiKey.findMany({ ...args, include: API_KEY_LIST_INCLUDE }),
			});
			return toPaginatedServiceResult(
				mapListResult(page, (row: ApiKeyListRow): MerchantApiKeySummary => ({
					id: row.id,
					name: row.name,
					locationId: row.locationId,
					locationName: row.location?.name ?? null,
					scope: row.scope,
					revokedAt: epochOrNull(row.revokedAt),
					createdAt: epochMs(Number(row.createdAt)),
					updatedAt: epochMs(Number(row.updatedAt)),
					isDeleted: row.isDeleted,
					deletedAt: epochOrNull(row.deletedAt),
				})),
				query,
			);
		});
	}
}

const REDEMPTION_LIST_INCLUDE = { claim: { select: { reward: { select: { title: true } } } } } satisfies Prisma.RewardRedemptionInclude;

type RedemptionListRow = Prisma.RewardRedemptionGetPayload<{ include: typeof REDEMPTION_LIST_INCLUDE }>;

/** Keyset for the default redemption order (`redeemedAt desc, id desc`). */
const REDEMPTION_LIST_KEYSET: ListKeyset<RedemptionListRow, Prisma.RewardRedemptionWhereInput> = timestampIdKeyset(
	(row: RedemptionListRow) => ({ at: Number(row.redeemedAt), id: row.id }),
	({ at, id }): Prisma.RewardRedemptionWhereInput => ({ OR: [{ redeemedAt: { lt: at } }, { redeemedAt: at, id: { lt: id } }] }),
);

/** The organization's redemption history within the caller's granted stores, read under the caller's RLS session (one query per page). */
export class PrismaRedemptionReadRepository implements RedemptionReadPort {
	public constructor(private readonly reads: PrismaReadExecutor<Prisma.TransactionClient>) {}

	public async list(actor: ActorContext, grant: MerchantAccessGrant, query: MerchantRedemptionListQuery): Promise<PaginatedServiceResult<MerchantRedemptionListItem>> {
		return this.reads.read(actor, async (db: Prisma.TransactionClient): Promise<PaginatedServiceResult<MerchantRedemptionListItem>> => {
			const page = await fetchListPage(query, {
				where: buildRedemptionListWhere(grant, query),
				order: buildRedemptionListOrder(query),
				keyset: REDEMPTION_LIST_KEYSET,
				and: (left: Prisma.RewardRedemptionWhereInput, right: Prisma.RewardRedemptionWhereInput): Prisma.RewardRedemptionWhereInput => ({ AND: [left, right] }),
				count: (where: Prisma.RewardRedemptionWhereInput): Promise<number> => db.rewardRedemption.count({ where }),
				findMany: (args): Promise<RedemptionListRow[]> => db.rewardRedemption.findMany({ ...args, include: REDEMPTION_LIST_INCLUDE }),
			});
			return toPaginatedServiceResult(
				mapListResult(page, (row: RedemptionListRow): MerchantRedemptionListItem => ({
					redemptionId: row.id,
					rewardTitle: row.claim.reward.title,
					redeemedAt: epochMs(Number(row.redeemedAt)),
					terminalId: row.terminalId,
					redemptionMethod: row.redemptionMethod,
				})),
				query,
			);
		});
	}
}
