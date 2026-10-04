import { Prisma, type Role } from "@prisma/client";

import { nowEpochMs } from "@workspace/shared";

import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { AuthorizationAuditService, type AuditActor } from "../../authorization/audit/authorization-audit.service";
import { RoleAssignmentRepository } from "../../authorization/repositories/role-assignment.repository";
import { RoleRepository } from "../../authorization/repositories/role.repository";
import { ConflictDetectionService } from "../../authorization/services/conflict-detection.service";
import type { OperatorIdentity, OperatorIdentityProvider } from "../../../common/operator-identity";
import type { BootstrapIdentity } from "./superadmin-bootstrap.args";
import { SUPER_ADMIN_ROLE_NAME, SUPERADMIN_BOOTSTRAP_LOCK_KEY, SUPERADMIN_BOOTSTRAP_OPERATION, SUPERADMIN_BOOTSTRAP_REASON } from "./superadmin-bootstrap.constants";
import { BootstrapEmailTakenError, SuperAdminAlreadyExistsError, SuperAdminRoleMissingError } from "./superadmin-bootstrap.errors";
import { SuperAdminBootstrapRepository, type CreatedSuperAdmin } from "./superadmin-bootstrap.repository";

/** Hashes a password with the application's own algorithm and cost (`CryptoService`). */
export interface PasswordHasher {
	hash(password: string): Promise<string>;
}

/** Prisma: unique constraint violated — an account with that email was created concurrently. */
const PRISMA_UNIQUE_CONSTRAINT_VIOLATION = "P2002";

/** The plaintext password is validated by the caller (signup's policy) and never leaves this call. */
export interface BootstrapRequest {
	readonly identity: BootstrapIdentity;
	readonly password: string;
}

/** What the command may report: never the password or its hash. */
export interface BootstrapOutcome {
	readonly userId: string;
	readonly email: string;
	readonly fullName: string;
}

/** The audit `detail` JSON: what was created and who ran the command. */
interface BootstrapAuditDetail {
	readonly email: string;
	readonly ranBy: OperatorIdentity;
}

/** Epoch-ms clock (injected so the tests are deterministic). */
export type EpochClock = () => number;

/**
 * Creates the platform's FIRST SuperAdmin from the command line — for deployments where the seed must
 * never run, so there is no seeded operator account.
 *
 * One transaction under the allowlisted `auth.superadmin.bootstrap` system operation:
 *
 * 1. a transaction-scoped advisory lock — a second concurrent run blocks until the first commits and
 *    then finds the SuperAdmin, so two runs can never both succeed;
 * 2. refuse if any active, non-deleted SuperAdmin exists (the command is one-time by construction), or
 *    the email is taken (it creates, never promotes);
 * 3. create the account exactly as the app would, except:
 *    - the email is marked VERIFIED: the operator proved control of the server (shell access + database
 *      credentials), and a fresh deployment may have no email delivery yet — an unverified sole admin
 *      would be locked out of the very panel that configures things;
 *    - the MFA enrollment deadline is NOW (signup grants a grace period; a platform operator gets none), so
 *      `SessionRestrictionService` issues a restricted session on first login until 2FA is enrolled;
 * 4. assign the `SuperAdmin` role and write the audit rows with the explicit actor
 *    `{ kind: "SYSTEM_OPERATION", operation }` — never a placeholder user — plus the OS user and host
 *    that ran the command in each row's detail.
 *
 * The password is hashed BEFORE the transaction so the lock is never held across the slow hash.
 */
export class SuperAdminBootstrapService {
	public constructor(
		private readonly tenantTx: TenantTransactionService,
		private readonly repository: SuperAdminBootstrapRepository,
		private readonly roles: RoleRepository,
		private readonly assignments: RoleAssignmentRepository,
		private readonly conflicts: ConflictDetectionService,
		private readonly audit: AuthorizationAuditService,
		private readonly hasher: PasswordHasher,
		private readonly operator: OperatorIdentityProvider,
		private readonly clock: EpochClock = nowEpochMs,
	) {}

	/**
	 * @throws SuperAdminAlreadyExistsError when the platform already has an active SuperAdmin
	 * @throws BootstrapEmailTakenError when the email already belongs to an account
	 * @throws SuperAdminRoleMissingError when the platform role catalog has not been loaded
	 */
	public async bootstrap(request: BootstrapRequest): Promise<BootstrapOutcome> {
		const passwordHash: string = await this.hasher.hash(request.password);
		const detail: string = JSON.stringify({ email: request.identity.email, ranBy: this.operator.current() } satisfies BootstrapAuditDetail);

		const user: CreatedSuperAdmin = await this.tenantTx.withSystemOperation(
			{ operation: SUPERADMIN_BOOTSTRAP_OPERATION, reason: SUPERADMIN_BOOTSTRAP_REASON, actorUserId: null },
			async (tx: Prisma.TransactionClient): Promise<CreatedSuperAdmin> => {
				await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${SUPERADMIN_BOOTSTRAP_LOCK_KEY}, 0))`;
				return this.createUnderLock(request.identity, passwordHash, detail, tx);
			},
		);
		return { userId: user.id, email: user.email, fullName: user.fullName };
	}

	private async createUnderLock(identity: BootstrapIdentity, passwordHash: string, detail: string, tx: Prisma.TransactionClient): Promise<CreatedSuperAdmin> {
		if ((await this.repository.countActiveSuperAdmins(tx)) > 0) {
			throw new SuperAdminAlreadyExistsError();
		}
		if (await this.repository.emailExists(identity.email, tx)) {
			throw new BootstrapEmailTakenError();
		}
		const role: Role | null = await this.roles.findByName(SUPER_ADMIN_ROLE_NAME, tx);
		if (role === null) {
			throw new SuperAdminRoleMissingError();
		}

		const now: number = this.clock();
		const user: CreatedSuperAdmin = await this.createAccount(identity, passwordHash, now, tx);
		await this.assignments.assignRoleToUser(user.id, role.id, SUPERADMIN_BOOTSTRAP_OPERATION, tx);
		await this.conflicts.assertUsersHaveNoConflicts([user.id], tx);

		const actor: AuditActor = { kind: "SYSTEM_OPERATION", operation: SUPERADMIN_BOOTSTRAP_OPERATION };
		await this.audit.record({ action: "SUPER_ADMIN_BOOTSTRAPPED", actor, targetUserId: user.id, targetRoleId: role.id, detail }, tx);
		await this.audit.record({ action: "ROLE_ASSIGNED_AT_PROVISIONING", actor, targetUserId: user.id, targetRoleId: role.id, detail }, tx);
		return user;
	}

	private async createAccount(identity: BootstrapIdentity, passwordHash: string, now: number, tx: Prisma.TransactionClient): Promise<CreatedSuperAdmin> {
		try {
			return await this.repository.createSuperAdmin(
				{ email: identity.email, fullName: identity.fullName, passwordHash, emailVerifiedAt: now, mfaEnrollmentDeadline: now },
				tx,
			);
		} catch (error) {
			if (error instanceof Error && isUniqueViolation(error)) {
				throw new BootstrapEmailTakenError();
			}
			throw error;
		}
	}
}

function isUniqueViolation(error: Error): boolean {
	return error instanceof Prisma.PrismaClientKnownRequestError && error.code === PRISMA_UNIQUE_CONSTRAINT_VIOLATION;
}
