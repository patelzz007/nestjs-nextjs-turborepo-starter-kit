import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import {
	adminMfaRecoveryListQuery,
	adminUserListQuery,
	assertNever,
	epochMs,
	nowEpochMs,
	parseUserPreferenceValue,
	UserPreferenceKeySchema,
	UserPreferenceValueSchema,
	type AdminMfaRecoveryListQuery,
	type AdminMfaRecoveryListSortField,
	type AdminMfaRecoveryRequest,
	type AdminUserListQuery,
	type AdminUserListSortField,
	type AdminUserStatus,
	type EpochMs,
	type MfaRecoveryStatusResponse,
	type OwnProfile,
	type PaginatedServiceResult,
	type Session,
	type SessionListQuery,
	type SessionListSortField,
	sessionListQuery,
	type UserPreference,
	type UserPreferences,
} from "@workspace/shared";

import { PublicUrlResolver } from "../../../../config/public-url.resolver";
import { actingUserId, type ActorContext } from "../../../../platform/application/actor-context";
import type { SystemOperationName } from "../../../../platform/application/system-operation-names";
import { fetchListPage, mapListResult, toPaginatedServiceResult } from "../../../../platform/infrastructure/persistence/list-page";
import { timestampIdKeyset, type ListKeyset } from "../../../../platform/infrastructure/persistence/list-query/keyset-cursor";
import { buildListOrder, type ListOrder, type SortColumns } from "../../../../platform/infrastructure/persistence/list-query/list-order";
import { fieldWhere, toPrismaEqualityFilter } from "../../../../platform/infrastructure/persistence/list-query/prisma-filter";
import { toRlsTransactionScope, USER_OWNED_DATA_SCOPE } from "../../../../platform/infrastructure/unit-of-work/actor-to-rls-context";
import { systemRlsContext } from "../../../../prisma/rls-context";
import { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";
import type { AccountView, AdminAccountView, IdentityReadPort } from "../../application/ports/identity-read.port";
import { ACCOUNT_LOOKUP_OPERATION, ADMIN_USERS_READ_OPERATION, MFA_RECOVERY_LIST_OPERATION, PASSWORD_RESET_LOOKUP_OPERATION } from "../../application/ports/identity.tokens";
import { toMfaRecoveryStatusResponse } from "../../application/services/mfa-recovery-status";
import { buildSessionDeviceLabel } from "../../domain/value-objects/session-device.value-object";
import { ACCOUNT_VIEW_SELECT, ADMIN_ACCOUNT_VIEW_SELECT, epochOrNull, toAccountView, toAdminAccountView, type AdminAccountViewRow } from "./identity-row.mappers";
import { readOwnProfile } from "./own-profile.projection";

// ── Admin user list: query → Prisma (explicit field → column mapping; docs/technical/api/list-queries.md) ──

const ADMIN_USER_SORT_COLUMNS: SortColumns<AdminUserListSortField, Prisma.UserOrderByWithRelationInput> = {
	fullName: (direction) => ({ fullName: direction }),
	email: (direction) => ({ email: direction }),
	createdAt: (direction) => ({ createdAt: direction }),
};

/** Keyset for the default order (`createdAt desc, id desc`). */
const ADMIN_USER_LIST_KEYSET: ListKeyset<AdminAccountViewRow, Prisma.UserWhereInput> = timestampIdKeyset(
	(row: AdminAccountViewRow) => ({ at: Number(row.createdAt), id: row.id }),
	({ at, id }): Prisma.UserWhereInput => ({ OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: id } }] }),
);

/** The derived `status` filter (`isActive` + `lockedUntil`) → its column conditions, evaluated at `now`. */
function buildAdminUserStatusWhere(status: AdminUserStatus, now: bigint): Prisma.UserWhereInput {
	switch (status) {
		case "active":
			return { isActive: true, OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }] };
		case "inactive":
			return { isActive: false, bannedAt: null };
		case "banned":
			return { bannedAt: { not: null } };
		case "locked":
			return { lockedUntil: { gt: now } };
		default:
			return assertNever(status, "admin user status");
	}
}

/** Search + the filter AST, one explicit condition per whitelisted field. */
export function buildAdminUserListWhere(query: AdminUserListQuery, now: bigint): Prisma.UserWhereInput {
	const status: AdminUserStatus | undefined = query.filter?.status?.eq;
	const role: string | undefined = query.filter?.role?.eq;
	const referrerId: string | undefined = query.filter?.referrerId?.eq;
	const referralStatus: "not_redeemed" | "redeemed" | undefined = query.filter?.referralStatus?.eq;
	const conditions: Prisma.UserWhereInput[] = [
		...(query.search !== undefined
			? [{ OR: [{ fullName: { contains: query.search, mode: "insensitive" } }, { email: { contains: query.search, mode: "insensitive" } }] } satisfies Prisma.UserWhereInput]
			: []),
		...(status !== undefined ? [buildAdminUserStatusWhere(status, now)] : []),
		...(role !== undefined ? [{ userRoles: { some: { isDeleted: false, role: { name: role, isDeleted: false } } } } satisfies Prisma.UserWhereInput] : []),
		...(referrerId !== undefined ? [{ signupReferralsAsReferee: { isDeleted: false, referrerUserId: referrerId } } satisfies Prisma.UserWhereInput] : []),
		...(referralStatus === "not_redeemed" ? [{ signupReferralsAsReferee: { isDeleted: false, successfulAt: null } } satisfies Prisma.UserWhereInput] : []),
		...(referralStatus === "redeemed" ? [{ signupReferralsAsReferee: { isDeleted: false, successfulAt: { not: null } } } satisfies Prisma.UserWhereInput] : []),
	];
	return { AND: conditions };
}

export function buildAdminUserListOrder(query: AdminUserListQuery): ListOrder<Prisma.UserOrderByWithRelationInput> {
	return buildListOrder(adminUserListQuery.resolveSort(query.sort), { columns: ADMIN_USER_SORT_COLUMNS, tieBreaker: (direction) => ({ id: direction }) });
}

// ── MFA recovery list ──

const MFA_RECOVERY_ADMIN_INCLUDE = { user: { select: { email: true, fullName: true } } } satisfies Prisma.MfaRecoveryRequestInclude;

type MfaRecoveryAdminRow = Prisma.MfaRecoveryRequestGetPayload<{ include: typeof MFA_RECOVERY_ADMIN_INCLUDE }>;

const MFA_RECOVERY_SORT_COLUMNS: SortColumns<AdminMfaRecoveryListSortField, Prisma.MfaRecoveryRequestOrderByWithRelationInput> = {
	requestedAt: (direction) => ({ requestedAt: direction }),
	createdAt: (direction) => ({ createdAt: direction }),
};

/** Keyset for the default order (`requestedAt desc, id desc`). */
const MFA_RECOVERY_LIST_KEYSET: ListKeyset<MfaRecoveryAdminRow, Prisma.MfaRecoveryRequestWhereInput> = timestampIdKeyset(
	(row: MfaRecoveryAdminRow) => ({ at: Number(row.requestedAt), id: row.id }),
	({ at, id }): Prisma.MfaRecoveryRequestWhereInput => ({ OR: [{ requestedAt: { lt: at } }, { requestedAt: at, id: { lt: id } }] }),
);

export function buildMfaRecoveryListWhere(query: AdminMfaRecoveryListQuery): Prisma.MfaRecoveryRequestWhereInput {
	const filter = query.filter;
	return {
		AND: [...fieldWhere(toPrismaEqualityFilter(filter?.status), (status) => ({ status })), ...fieldWhere(toPrismaEqualityFilter(filter?.userId), (userId) => ({ userId }))],
	};
}

export function buildMfaRecoveryListOrder(query: AdminMfaRecoveryListQuery): ListOrder<Prisma.MfaRecoveryRequestOrderByWithRelationInput> {
	return buildListOrder(adminMfaRecoveryListQuery.resolveSort(query.sort), { columns: MFA_RECOVERY_SORT_COLUMNS, tieBreaker: (direction) => ({ id: direction }) });
}

function toAdminMfaRecovery(row: MfaRecoveryAdminRow): AdminMfaRecoveryRequest {
	return {
		id: row.id,
		userId: row.userId,
		userEmail: row.user.email,
		userFullName: row.user.fullName,
		status: row.status,
		requestedAt: epochMs(Number(row.requestedAt)),
		reviewedBy: row.reviewedBy,
		reviewedAt: epochOrNull(row.reviewedAt),
		scheduledUnlockAt: epochOrNull(row.scheduledUnlockAt),
		completedAt: epochOrNull(row.completedAt),
		notes: row.notes,
	};
}

// ── Device list ──

const DEVICE_SESSION_SELECT = {
	id: true,
	clientType: true,
	browserName: true,
	browserVersion: true,
	osName: true,
	osVersion: true,
	deviceType: true,
	deviceModel: true,
	deviceName: true,
	appVersion: true,
	signInMethod: true,
	ipAddress: true,
	lastIpAddress: true,
	locationCountry: true,
	locationRegion: true,
	locationCity: true,
	createdAt: true,
	lastActiveAt: true,
	expiresAt: true,
} satisfies Prisma.RefreshTokenSelect;

type DeviceSessionRow = Prisma.RefreshTokenGetPayload<{ select: typeof DEVICE_SESSION_SELECT }>;

// ── Own session list (`GET /auth/sessions`) ──

const SESSION_SORT_COLUMNS: SortColumns<SessionListSortField, Prisma.RefreshTokenOrderByWithRelationInput> = {
	lastActiveAt: (direction) => ({ lastActiveAt: direction }),
	createdAt: (direction) => ({ createdAt: direction }),
};

/** Keyset for the default order (`lastActiveAt desc, id desc`). */
const SESSION_LIST_KEYSET: ListKeyset<DeviceSessionRow, Prisma.RefreshTokenWhereInput> = timestampIdKeyset(
	(row: DeviceSessionRow) => ({ at: Number(row.lastActiveAt), id: row.id }),
	({ at, id }): Prisma.RefreshTokenWhereInput => ({ OR: [{ lastActiveAt: { lt: at } }, { lastActiveAt: at, id: { lt: id } }] }),
);

export function buildSessionListOrder(query: SessionListQuery): ListOrder<Prisma.RefreshTokenOrderByWithRelationInput> {
	return buildListOrder(sessionListQuery.resolveSort(query.sort), { columns: SESSION_SORT_COLUMNS, tieBreaker: (direction) => ({ id: direction }) });
}

function toSession(row: DeviceSessionRow, currentSessionId: string | null): Session {
	const record = {
		id: row.id,
		clientType: row.clientType,
		browserName: row.browserName,
		browserVersion: row.browserVersion,
		osName: row.osName,
		osVersion: row.osVersion,
		deviceType: row.deviceType,
		deviceModel: row.deviceModel,
		deviceName: row.deviceName,
		appVersion: row.appVersion,
		signInMethod: row.signInMethod,
		ipAddress: row.ipAddress,
		lastIpAddress: row.lastIpAddress,
		location: row.locationCountry === null ? null : { country: row.locationCountry, region: row.locationRegion, city: row.locationCity },
		createdAt: epochMs(Number(row.createdAt)),
		lastActiveAt: epochMs(Number(row.lastActiveAt)),
		expiresAt: epochMs(Number(row.expiresAt)),
	};
	return { ...record, label: buildSessionDeviceLabel(record), isCurrent: row.id === currentSessionId };
}

/**
 * Identity's read side. Every read runs in a short transaction stamped with the actor's RLS session
 * (`PrismaReadExecutor` semantics). A public credential read names its own operation.
 */
@Injectable()
export class PrismaIdentityReadRepository implements IdentityReadPort {
	public constructor(
		private readonly transactions: TenantTransactionService,
		private readonly publicUrls: PublicUrlResolver,
	) {}

	public findAccount(actor: ActorContext, userId: string): Promise<AccountView | null> {
		return this.asActor(actor, async (db) => {
			const row = await db.user.findUnique({ where: { id: userId }, select: ACCOUNT_VIEW_SELECT });
			return row === null ? null : toAccountView(row);
		});
	}

	public findAccountByEmail(actor: ActorContext, email: string): Promise<AccountView | null> {
		return this.asNamedRead(actor, ACCOUNT_LOOKUP_OPERATION, async (db) => {
			const row = await db.user.findUnique({ where: { email }, select: ACCOUNT_VIEW_SELECT });
			return row === null ? null : toAccountView(row);
		});
	}

	public listAdminAccounts(actor: ActorContext, query: AdminUserListQuery): Promise<PaginatedServiceResult<AdminAccountView>> {
		return this.asNamedRead(actor, ADMIN_USERS_READ_OPERATION, async (db) => {
			const result = await fetchListPage(query, {
				where: buildAdminUserListWhere(query, BigInt(nowEpochMs())),
				order: buildAdminUserListOrder(query),
				keyset: ADMIN_USER_LIST_KEYSET,
				and: (left, right) => ({ AND: [left, right] }),
				count: (where) => db.user.count({ where }),
				findMany: (args): Promise<AdminAccountViewRow[]> => db.user.findMany({ ...args, select: ADMIN_ACCOUNT_VIEW_SELECT }),
			});
			return toPaginatedServiceResult(mapListResult(result, toAdminAccountView), query);
		});
	}

	public findAdminAccount(actor: ActorContext, userId: string): Promise<AdminAccountView | null> {
		return this.asNamedRead(actor, ADMIN_USERS_READ_OPERATION, async (db) => {
			const row = await db.user.findUnique({ where: { id: userId }, select: ADMIN_ACCOUNT_VIEW_SELECT });
			return row === null ? null : toAdminAccountView(row);
		});
	}

	public findOwnProfile(actor: ActorContext, userId: string): Promise<OwnProfile | null> {
		return this.asActor(actor, (db) => readOwnProfile(db, userId, this.publicUrls.resolve));
	}

	public listOwnPreferences(actor: ActorContext, userId: string): Promise<UserPreferences> {
		return this.asActor(actor, async (db): Promise<UserPreferences> => {
			const rows = await db.userPreference.findMany({ where: { userId, isDeleted: false }, orderBy: [{ key: "asc" }], select: { key: true, value: true, version: true } });
			return {
				preferences: rows.flatMap((row): UserPreference[] => {
					const key = UserPreferenceKeySchema.safeParse(row.key);
					const value = UserPreferenceValueSchema.safeParse(row.value);
					const accepted = key.success && value.success ? parseUserPreferenceValue(key.data, value.data) : null;
					return key.success && accepted !== null ? [{ key: key.data, value: accepted, version: row.version }] : [];
				}),
			};
		});
	}

	public listActiveSessions(actor: ActorContext, userId: string, currentSessionId: string | null, query: SessionListQuery): Promise<PaginatedServiceResult<Session>> {
		return this.asActor(actor, async (db) => {
			const result = await fetchListPage(query, {
				where: { userId, isDeleted: false, expiresAt: { gte: nowEpochMs() } },
				order: buildSessionListOrder(query),
				keyset: SESSION_LIST_KEYSET,
				and: (left, right) => ({ AND: [left, right] }),
				count: (where) => db.refreshToken.count({ where }),
				findMany: (args): Promise<DeviceSessionRow[]> => db.refreshToken.findMany({ ...args, select: DEVICE_SESSION_SELECT }),
			});
			return toPaginatedServiceResult(
				mapListResult(result, (row: DeviceSessionRow): Session => toSession(row, currentSessionId)),
				query,
			);
		});
	}

	public countUnusedBackupCodes(actor: ActorContext, userId: string): Promise<number> {
		return this.asActor(actor, (db) => db.backupCode.count({ where: { userId, usedAt: null, isDeleted: false } }));
	}

	public unusedBackupCodeHashes(actor: ActorContext, userId: string): Promise<readonly string[]> {
		return this.asActor(actor, async (db) =>
			(await db.backupCode.findMany({ where: { userId, usedAt: null, isDeleted: false }, select: { codeHash: true } })).map((row) => row.codeHash),
		);
	}

	public latestMfaRecovery(actor: ActorContext, userId: string): Promise<MfaRecoveryStatusResponse | null> {
		return this.asActor(actor, async (db) => {
			const row = await db.mfaRecoveryRequest.findFirst({ where: { userId }, orderBy: { requestedAt: "desc" }, select: { status: true, scheduledUnlockAt: true } });
			return row === null ? null : toMfaRecoveryStatusResponse({ status: row.status, scheduledUnlockAt: epochOrNull(row.scheduledUnlockAt) });
		});
	}

	public listMfaRecoveries(actor: ActorContext, query: AdminMfaRecoveryListQuery): Promise<PaginatedServiceResult<AdminMfaRecoveryRequest>> {
		return this.asNamedRead(actor, MFA_RECOVERY_LIST_OPERATION, async (db) => {
			const result = await fetchListPage(query, {
				where: buildMfaRecoveryListWhere(query),
				order: buildMfaRecoveryListOrder(query),
				keyset: MFA_RECOVERY_LIST_KEYSET,
				and: (left, right) => ({ AND: [left, right] }),
				count: (where) => db.mfaRecoveryRequest.count({ where }),
				findMany: (args): Promise<MfaRecoveryAdminRow[]> => db.mfaRecoveryRequest.findMany({ ...args, include: MFA_RECOVERY_ADMIN_INCLUDE }),
			});
			return toPaginatedServiceResult(mapListResult(result, toAdminMfaRecovery), query);
		});
	}

	public findUsableResetTokenHash(actor: ActorContext, tokenDigest: string, now: EpochMs): Promise<{ readonly userId: string; readonly tokenHash: string } | null> {
		return this.asNamedRead(actor, PASSWORD_RESET_LOOKUP_OPERATION, async (db) => {
			const row = await db.passwordResetToken.findFirst({
				where: { tokenDigest, usedAt: null, expiresAt: { gte: now }, isDeleted: false },
				select: { userId: true, token: true },
			});
			return row === null ? null : { userId: row.userId, tokenHash: row.token };
		});
	}

	private asActor<TResult>(actor: ActorContext, work: (db: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult> {
		// Identity reads the user's own rows (scoped by user id): no tenant is needed.
		return this.transactions.withRlsContext(toRlsTransactionScope(actor, USER_OWNED_DATA_SCOPE), work);
	}

	private asNamedRead<TResult>(actor: ActorContext, operation: SystemOperationName, work: (db: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult> {
		const actorUserId: string | null = actingUserId(actor);
		return this.transactions.withRlsContext({ context: systemRlsContext(operation, actorUserId, actor.tenantId), reason: operation }, work);
	}
}
