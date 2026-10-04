import type { Prisma, User } from "@prisma/client";

import { SUPER_ADMIN_ROLE_NAME } from "./superadmin-bootstrap.constants";

/** The part of the created row the bootstrap needs back (never the password hash). */
export type CreatedSuperAdmin = Pick<User, "id" | "email" | "fullName">;

/** What the bootstrap writes into `users`. */
export interface NewSuperAdminRecord {
	readonly email: string;
	readonly fullName: string;
	readonly passwordHash: string;
	readonly emailVerifiedAt: number;
	readonly mfaEnrollmentDeadline: number;
}

/**
 * Persistence for the bootstrap (composed by hand by the command, not a Nest provider). Every method takes the caller's transaction client: the
 * "is there a SuperAdmin" check and the insert must see one consistent state under the bootstrap lock.
 */
export class SuperAdminBootstrapRepository {
	/**
	 * Active, non-deleted accounts that are a SuperAdmin — by the `isSuperAdmin` flag the guards honour, or by
	 * holding a live assignment of the live, active `SuperAdmin` role. Either one means the platform is bootstrapped.
	 */
	public async countActiveSuperAdmins(db: Prisma.TransactionClient): Promise<number> {
		return db.user.count({
			where: {
				isDeleted: false,
				isActive: true,
				OR: [{ isSuperAdmin: true }, { userRoles: { some: { isDeleted: false, role: { name: SUPER_ADMIN_ROLE_NAME, isDeleted: false, isActive: true } } } }],
			},
		});
	}

	/** Whether any account — live or soft-deleted, the email is unique across both — already uses `email`. */
	public async emailExists(email: string, db: Prisma.TransactionClient): Promise<boolean> {
		return (await db.user.count({ where: { email } })) > 0;
	}

	public async createSuperAdmin(record: NewSuperAdminRecord, db: Prisma.TransactionClient): Promise<CreatedSuperAdmin> {
		return db.user.create({
			data: {
				email: record.email,
				fullName: record.fullName,
				passwordHash: record.passwordHash,
				isSuperAdmin: true,
				emailVerifiedAt: record.emailVerifiedAt,
				mfaEnrollmentDeadline: record.mfaEnrollmentDeadline,
			},
			select: { id: true, email: true, fullName: true },
		});
	}
}
