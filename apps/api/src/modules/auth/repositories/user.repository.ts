import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { AdminUserListQuery } from "@workspace/shared";

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
} as const satisfies Prisma.UserSelect;

const USER_SELECT_PROFILE = {
	...USER_SELECT_BASE,
	emailVerifiedAt: true,
	tokenVersion: true,
	twoFactorEnabled: true,
} as const satisfies Prisma.UserSelect;

const USER_SELECT_LOGIN = {
	...USER_SELECT_PROFILE,
	passwordHash: true,
	failedLoginAttempts: true,
	lockedUntil: true,
	twoFactorSecret: true,
} as const satisfies Prisma.UserSelect;

const USER_SELECT_ADMIN_DETAIL = {
	...USER_SELECT_PROFILE,
	failedLoginAttempts: true,
	lockedUntil: true,
} as const satisfies Prisma.UserSelect;

/** Base user fields returned from queries. */
export type UserBase = Prisma.UserGetPayload<{ select: typeof USER_SELECT_BASE }>;

/** Profile fields (base + emailVerifiedAt + tokenVersion). */
export type UserProfile = Prisma.UserGetPayload<{ select: typeof USER_SELECT_PROFILE }>;

/** Login fields (profile + passwordHash + lockout fields). */
export type UserLogin = Prisma.UserGetPayload<{ select: typeof USER_SELECT_LOGIN }>;

/** Admin detail fields (profile + lockout fields). */
export type UserAdminDetail = Prisma.UserGetPayload<{ select: typeof USER_SELECT_ADMIN_DETAIL }>;

const ADMIN_USER_SORT_FIELDS: readonly ["fullName", "email", "createdAt", "isActive", "isSuperAdmin"] = ["fullName", "email", "createdAt", "isActive", "isSuperAdmin"];

function isAdminUserSortField(field: string): field is (typeof ADMIN_USER_SORT_FIELDS)[number] {
	return ADMIN_USER_SORT_FIELDS.some((allowed) => allowed === field);
}

function buildAdminUserListWhere(query: AdminUserListQuery): Prisma.UserWhereInput {
	const parts: Prisma.UserWhereInput[] = [];
	const search = query.search?.trim();

	if (search !== undefined && search.length > 0) {
		parts.push({
			OR: [{ fullName: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }],
		});
	}

	if (query.status === "active") {
		parts.push({
			isActive: true,
			OR: [{ lockedUntil: null }, { lockedUntil: { lte: BigInt(Date.now()) } }],
		});
	} else if (query.status === "inactive") {
		parts.push({ isActive: false });
	} else if (query.status === "locked") {
		parts.push({ lockedUntil: { gt: BigInt(Date.now()) } });
	}

	if (query.role !== undefined && query.role.length > 0) {
		parts.push({
			userRoles: {
				some: {
					isDeleted: false,
					role: { name: query.role, isDeleted: false },
				},
			},
		});
	}

	if (parts.length === 0) {
		return {};
	}
	if (parts.length === 1) {
		const single = parts[0];
		if (single !== undefined) {
			return single;
		}
	}
	return { AND: parts };
}

function parseAdminUserListOrderBy(sort: string | undefined): Prisma.UserOrderByWithRelationInput {
	if (sort === undefined || sort.length === 0) {
		return { createdAt: "desc" };
	}
	const desc = sort.startsWith("-");
	const field = desc ? sort.slice(1) : sort;
	const direction: Prisma.SortOrder = desc ? "desc" : "asc";
	if (!isAdminUserSortField(field)) {
		return { createdAt: "desc" };
	}
	switch (field) {
		case "fullName":
			return { fullName: direction };
		case "email":
			return { email: direction };
		case "createdAt":
			return { createdAt: direction };
		case "isActive":
			return { isActive: direction };
		case "isSuperAdmin":
			return { isSuperAdmin: direction };
	}
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
	public async listAdminUsers(query: AdminUserListQuery): Promise<readonly UserAdminDetail[]> {
		const skip = (query.page - 1) * query.limit;
		return this.prisma.user.findMany({
			where: buildAdminUserListWhere(query),
			orderBy: parseAdminUserListOrderBy(query.sort),
			skip,
			take: query.limit,
			select: USER_SELECT_ADMIN_DETAIL,
		});
	}

	/** Count users matching admin list filters. */
	public async countAdminUsers(query: AdminUserListQuery): Promise<number> {
		return this.prisma.user.count({
			where: buildAdminUserListWhere(query),
		});
	}

	/** Update a user's fields by ID. */
	public async update(id: string, data: Prisma.UserUpdateInput): Promise<void> {
		await this.prisma.user.update({
			where: { id },
			data: { ...data, updatedAt: Date.now() },
		});
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
