/** Command-line flags. The password has NO flag: argv is visible in `ps` and shell history. */
export const BOOTSTRAP_FLAGS = {
	email: "--email",
	fullName: "--full-name",
	passwordStdin: "--password-stdin",
	help: "--help",
	/** Rejected on sight — see {@link FORBIDDEN_PASSWORD_FLAGS}. */
	password: "--password",
} satisfies Record<string, string>;

/** Flags that would put the secret in argv; refused with an explanation rather than ignored. */
export const FORBIDDEN_PASSWORD_FLAGS: readonly string[] = [BOOTSTRAP_FLAGS.password, "--pass", "--pwd"];

/** Longest full name the `User.full_name` column (`VARCHAR(100)`) stores. */
export const FULL_NAME_MAX_LENGTH = 100;

/** Exit codes of the command. */
export const BOOTSTRAP_EXIT_CODES = {
	success: 0,
	/** The platform already has an active SuperAdmin (or the email is taken): nothing was changed. */
	refused: 1,
	/** Prerequisite missing (reference data not loaded). */
	notReady: 2,
	/** sysexits.h EX_USAGE: bad arguments or an invalid password/email. */
	usage: 64,
} satisfies Record<string, number>;
