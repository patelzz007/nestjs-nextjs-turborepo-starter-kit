import { SUPER_ADMIN_ROLE_NAME } from "./superadmin-bootstrap.constants";

/** An active, non-deleted SuperAdmin already exists: the bootstrap is one-time and refuses. */
export class SuperAdminAlreadyExistsError extends Error {
	public constructor() {
		super("An active SuperAdmin already exists, so this one-time command refuses to run. Manage SuperAdmins from the admin panel (Roles) instead.");
		this.name = "SuperAdminAlreadyExistsError";
	}
}

/** The email already belongs to an account — the bootstrap creates an account, it never promotes one. */
export class BootstrapEmailTakenError extends Error {
	public constructor() {
		super("An account with that email already exists. The bootstrap creates a new account and never promotes an existing one; use a different email.");
		this.name = "BootstrapEmailTakenError";
	}
}

/** The platform role catalog is not loaded, so the SuperAdmin role cannot be assigned. */
export class SuperAdminRoleMissingError extends Error {
	public constructor() {
		super(
			`The platform role "${SUPER_ADMIN_ROLE_NAME}" does not exist. Load the reference data first with "pnpm --filter @workspace/api db:sync-reference-data" (idempotent, creates no users or demo data), then re-run.`,
		);
		this.name = "SuperAdminRoleMissingError";
	}
}

/** The command line is invalid (unknown flag, missing value, secret on argv, or an unusable password source). */
export class BootstrapUsageError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = "BootstrapUsageError";
	}
}
