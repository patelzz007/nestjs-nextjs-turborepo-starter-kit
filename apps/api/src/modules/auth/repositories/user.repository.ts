import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { assertNever, adminUserListQuery, type AdminUserListQuery, type AdminUserListSortField, type AdminUserStatus } from "@workspace/shared";

import { fetchListPage } from "../../../platform/persistence/list-page";
import { timestampIdKeyset, type ListKeyset } from "../../../platform/persistence/list-query/keyset-cursor";
import { buildListOrder, type ListOrder, type SortColumns } from "../../../platform/persistence/list-query/list-order";
import type { RepositoryListResult } from "../../../platform/persistence/types";
import { PrismaService } from "../../../prisma/prisma.service";

/**
 * Canonical Prisma `select` clauses for user queries. Centralised here so
 * every auth service uses the same field set — no accidental divergence.
 */
const USER_SELECT_BASE = {
	id: true,
	email: true,
	fullName: true,
	isActive: true,
	isSuperAdmin: true,
	createdAt: true,
	updatedAt: true,
	isDeleted: true,
	deletedAt: true,
} satisfies Prisma.UserSelect;

const USER_SELECT_PROFILE = {
	...USER_SELECT_BASE,
	emailVerifiedAt: true,
	tokenVersion: true,
	twoFactorEnabled: true,
	mfaEnrollmentDeadline: true,
	mfaAssuredAt: true,
} satisfies Prisma.UserSelect;

const USER_SELECT_LOGIN = {
	...USER_SELECT_PROFILE,
	passwordHash: true,
	failedLoginAttempts: true,
	lockedUntil: true,
} satisfies Prisma.UserSelect;

const USER_SELECT_ADMIN_DETAIL = {
	...USER_SELECT_PROFILE,
	failedLoginAttempts: true,
	lockedUntil: true,
} satisfies Prisma.UserSelect;

/** Base user fields returned from queries. */
export type UserBase = Prisma.UserGetPayload<{ select: typeof USER_SELECT_BASE }>;

/** Profile fields (base + emailVerifiedAt + tokenVersion). */
export type UserProfile = Prisma.UserGetPayload<{ select: typeof USER_SELECT_PROFILE }>;

/** Login fields (profile + passwordHash + lockout fields). */
export type UserLogin = Prisma.UserGetPayload<{ select: typeof USER_SELECT_LOGIN }>;

/** Admin detail fields (profile + lockout fields). */
export type UserAdminDetail = Prisma.UserGetPayload<{ select: typeof USER_SELECT_ADMIN_DETAIL }>;

/** Every whitelisted admin-user sort field mapped to its column. */
const ADMIN_USER_SORT_COLUMNS: SortColumns<AdminUserListSortField, Prisma.UserOrderByWithRelationInput> = {
	fullName: (direction) => ({ fullName: direction }),
	email: (direction) => ({ email: direction }),
	createdAt: (direction) => ({ createdAt: direction }),
};

/** Keyset for the default order (`createdAt desc, id desc`). */
const ADMIN_USER_LIST_KEYSET: ListKeyset<UserAdminDetail, Prisma.UserWhereInput> = timestampIdKeyset(
	(row: UserAdminDetail) => ({ at: Number(row.createdAt), id: row.id }),
	({ at, id }): Prisma.UserWhereInput => ({ OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: id } }] }),
);

/** The derived `status` filter (`isActive` + `lockedUntil`) → its column conditions, evaluated at `now`. */
function buildAdminUserStatusWhere(status: AdminUserStatus, now: bigint): Prisma.UserWhereInput {
	switch (status) {
		case "active":
			return { isActive: true, OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }] };
		case "inactive":
			return { isActive: false };
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
	const conditions: Prisma.UserWhereInput[] = [
		...(query.search !== undefined
			? [{ OR: [{ fullName: { contains: query.search, mode: "insensitive" } }, { email: { contains: query.search, mode: "insensitive" } }] } satisfies Prisma.UserWhereInput]
			: []),
		...(status !== undefined ? [buildAdminUserStatusWhere(status, now)] : []),
		...(role !== undefined ? [{ userRoles: { some: { isDeleted: false, role: { name: role, isDeleted: false } } } } satisfies Prisma.UserWhereInput] : []),
	];
	return { AND: conditions };
}

export function buildAdminUserListOrder(query: AdminUserListQuery): ListOrder<Prisma.UserOrderByWithRelationInput> {
	return buildListOrder(adminUserListQuery.resolveSort(query.sort), {
		columns: ADMIN_USER_SORT_COLUMNS,
		tieBreaker: (direction) => ({ id: direction }),
	});
}

/**
 * Centralised user queries. Each method uses a typed `select` clause so
 * callers get strong types and accidental field leakage is impossible.
 */
@Injectable()
export class UserRepository {
	constructor(private readonly prisma: PrismaService) {}

	/** Find a user by ID with base fields. Throws if not found. */
	public async findById(id: string): Promise<UserBase> {
		const user = await this.prisma.user.findUnique({
			where: { id },
			select: USER_SELECT_BASE,
		});
		if (user === null) throw new NotFoundException("User not found");
		return user;
	}

	/** Find a user by ID with profile fields (emailVerifiedAt, tokenVersion). Throws if not found. */
	public async findProfileById(id: string): Promise<UserProfile> {
		const user = await this.prisma.user.findUnique({
			where: { id },
			select: USER_SELECT_PROFILE,
		});
		if (user === null) throw new NotFoundException("User not found");
		return user;
	}

	/** Find a user by email with base fields (for existence check). */
	public async findByEmail(email: string): Promise<UserBase | null> {
		return this.prisma.user.findUnique({
			where: { email },
			select: USER_SELECT_BASE,
		});
	}

	/** Find a user by email with profile fields. */
	public async findProfileByEmail(email: string): Promise<UserProfile | null> {
		return this.prisma.user.findUnique({
			where: { email },
			select: USER_SELECT_PROFILE,
		});
	}

	/** Find a user by ID with login fields (passwordHash + lockout). */
	public async findLoginById(id: string): Promise<UserLogin | null> {
		return this.prisma.user.findUnique({
			where: { id },
			select: USER_SELECT_LOGIN,
		});
	}

	/** Find a user by email with login fields (passwordHash + lockout). */
	public async findLoginByEmail(email: string): Promise<UserLogin | null> {
		return this.prisma.user.findUnique({
			where: { email },
			select: USER_SELECT_LOGIN,
		});
	}

	/** Find a user by email with minimal fields (for email verification). */
	public async findVerificationByEmail(email: string): Promise<{
		readonly id: string;
		readonly email: string;
		readonly isActive: boolean;
		readonly emailVerifiedAt: bigint | null;
		readonly isDeleted: boolean;
		readonly deletedAt: bigint | null;
	} | null> {
		return this.prisma.user.findUnique({
			where: { email },
			select: {
				id: true,
				email: true,
				isActive: true,
				emailVerifiedAt: true,
				isDeleted: true,
				deletedAt: true,
			},
		});
	}

	/** Find a user with admin detail fields (profile + lockout). Throws if not found. */
	public async findAdminDetailById(id: string): Promise<UserAdminDetail> {
		const user = await this.prisma.user.findUnique({
			where: { id },
			select: USER_SELECT_ADMIN_DETAIL,
		});
		if (user === null) throw new NotFoundException("User not found");
		return user;
	}

	/** List users with admin detail fields, filtered and paginated. */
	public async listAdminUsers(query: AdminUserListQuery): Promise<RepositoryListResult<UserAdminDetail>> {
		return fetchListPage(query, {
			where: buildAdminUserListWhere(query, BigInt(Date.now())),
			order: buildAdminUserListOrder(query),
			keyset: ADMIN_USER_LIST_KEYSET,
			and: (left, right) => ({ AND: [left, right] }),
			count: (where) => this.prisma.user.count({ where }),
			findMany: (args): Promise<UserAdminDetail[]> => this.prisma.user.findMany({ ...args, select: USER_SELECT_ADMIN_DETAIL }),
		});
	}

	/** Update a user's fields by ID. */
	public async update(id: string, data: Prisma.UserUpdateInput): Promise<void> {
		await this.prisma.user.update({
			where: { id },
			data: { ...data, updatedAt: Date.now() },
		});
	}

	/**
	 * Marks the email verified only if it is not yet — one conditional update,
	 * so two concurrent verifications cannot both "win". Returns whether THIS
	 * call verified it (false: it was already verified).
	 */
	public async markEmailVerifiedIfUnverified(id: string, verifiedAt: number): Promise<boolean> {
		const result = await this.prisma.user.updateMany({
			where: { id, emailVerifiedAt: null },
			data: { emailVerifiedAt: verifiedAt, updatedAt: verifiedAt },
		});
		return result.count === 1;
	}

	/** Create a new user. Returns base fields. */
	public async create(data: { readonly email: string; readonly passwordHash: string; readonly fullName: string }): Promise<UserBase> {
		return this.prisma.user.create({
			data,
			select: USER_SELECT_BASE,
		});
	}

	/** Check whether an email is already taken. */
	public async existsByEmail(email: string): Promise<boolean> {
		const user = await this.prisma.user.findUnique({
			where: { email },
			select: { id: true },
		});
		return user !== null;
	}

	/** Find a user by email with minimal fields for password-reset lookup. */
	public async findResetLookupByEmail(
		email: string,
	): Promise<{ readonly id: string; readonly email: string; readonly isActive: boolean; readonly isDeleted: boolean; readonly deletedAt: bigint | null } | null> {
		return this.prisma.user.findUnique({
			where: { email },
			select: {
				id: true,
				email: true,
				isActive: true,
				isDeleted: true,
				deletedAt: true,
			},
		});
	}

	/** Find a user by email for verification (includes emailVerifiedAt). */
	public async findForVerifyByEmail(email: string): Promise<{
		readonly id: string;
		readonly email: string;
		readonly isActive: boolean;
		readonly emailVerifiedAt: bigint | null;
		readonly isDeleted: boolean;
		readonly deletedAt: bigint | null;
	} | null> {
		return this.prisma.user.findUnique({
			where: { email },
			select: {
				id: true,
				email: true,
				isActive: true,
				emailVerifiedAt: true,
				isDeleted: true,
				deletedAt: true,
			},
		});
	}

	/** Find the lockout state for a user (used by AccountLockoutService). */
	public async findLockoutState(userId: string): Promise<{ readonly failedLoginAttempts: number; readonly lockedUntil: bigint | null } | null> {
		return this.prisma.user.findUnique({
			where: { id: userId },
			select: { failedLoginAttempts: true, lockedUntil: true },
		});
	}
}
