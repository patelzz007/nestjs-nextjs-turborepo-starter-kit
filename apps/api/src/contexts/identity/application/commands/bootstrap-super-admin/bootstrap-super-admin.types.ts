/** The first SuperAdmin's identity (validated by the CLI with signup's email and name rules). */
export interface BootstrapIdentity {
	readonly email: string;
	readonly fullName: string;
}

/** What the command may report: never the password or its hash. */
export interface BootstrapOutcome {
	readonly userId: string;
	readonly email: string;
	readonly fullName: string;
}
