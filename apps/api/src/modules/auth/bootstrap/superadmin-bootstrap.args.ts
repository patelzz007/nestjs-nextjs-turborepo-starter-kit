import { parseArgs, type ParseArgsConfig } from "node:util";

import { z } from "zod";

import { SignupSchema } from "@workspace/shared";

import { BOOTSTRAP_FLAGS, FORBIDDEN_PASSWORD_FLAGS, FULL_NAME_MAX_LENGTH } from "./superadmin-bootstrap.constants";
import { BootstrapUsageError } from "./superadmin-bootstrap.errors";

const ARGUMENT_SEPARATOR = "--";

/** `node:util` option table; the keys are the flag names without `--`. */
const OPTION_DEFINITIONS = {
	email: { type: "string" },
	"full-name": { type: "string" },
	"password-stdin": { type: "boolean" },
	help: { type: "boolean" },
} satisfies ParseArgsConfig["options"];

/** Where the password comes from: an interactive no-echo prompt, or the process's stdin. */
export const PasswordSourceSchema = z.enum(["prompt", "stdin"]);
export type PasswordSource = z.output<typeof PasswordSourceSchema>;

/** The identity of the account: the SAME email/full-name rules as signup (`SignupSchema`), plus the column's length bound. */
export const BootstrapIdentitySchema = SignupSchema.pick({ email: true, fullName: true }).extend({
	fullName: SignupSchema.shape.fullName.max(FULL_NAME_MAX_LENGTH),
});
export type BootstrapIdentity = z.output<typeof BootstrapIdentitySchema>;

/** The password, validated by exactly the policy signup applies. */
export const BootstrapPasswordSchema = SignupSchema.shape.password;

export type BootstrapCommand = { readonly kind: "help" } | { readonly kind: "run"; readonly identity: BootstrapIdentity; readonly passwordSource: PasswordSource };

/** The usage text printed for `--help` and after a usage error. Never mentions a way to pass the password inline. */
export function formatBootstrapUsage(): string {
	return [
		"Usage: pnpm --filter @workspace/api admin:bootstrap-superadmin -- --email <email> --full-name <name> [--password-stdin]",
		"",
		`  ${BOOTSTRAP_FLAGS.email} <email>      Login email of the first SuperAdmin (required)`,
		`  ${BOOTSTRAP_FLAGS.fullName} <name>  Display name, 2-${String(FULL_NAME_MAX_LENGTH)} characters (required)`,
		`  ${BOOTSTRAP_FLAGS.passwordStdin}       Read the password from stdin (CI / secret managers) instead of the no-echo prompt`,
		"",
		"The password is never accepted as an argument or environment variable, so it cannot leak through shell history or the process list.",
	].join("\n");
}

/**
 * Parse the command line. `--flag value` and `--flag=value` both work; an unknown flag, a missing value, or a
 * flag that would put the password on argv is a {@link BootstrapUsageError}.
 */
export function parseBootstrapArgs(rawArgv: readonly string[]): BootstrapCommand {
	// Some package-manager versions forward the `--` separator that precedes the script's own flags.
	const argv: readonly string[] = rawArgv.at(0) === ARGUMENT_SEPARATOR ? rawArgv.slice(1) : rawArgv;
	const forbidden: string | undefined = argv.find((arg: string): boolean =>
		FORBIDDEN_PASSWORD_FLAGS.some((flag: string): boolean => arg === flag || arg.startsWith(`${flag}=`)),
	);
	if (forbidden !== undefined) {
		throw new BootstrapUsageError(
			`The password cannot be passed on the command line (${forbidden.split("=")[0] ?? forbidden}): it would appear in shell history and the process list. Use the prompt, or ${BOOTSTRAP_FLAGS.passwordStdin}.`,
		);
	}

	const parsed = readOptions(argv);
	if (parsed.help === true) {
		return { kind: "help" };
	}

	const identity = BootstrapIdentitySchema.safeParse({ email: parsed.email, fullName: parsed["full-name"] });
	if (!identity.success) {
		throw new BootstrapUsageError(z.prettifyError(identity.error));
	}
	return { kind: "run", identity: identity.data, passwordSource: parsed["password-stdin"] === true ? "stdin" : "prompt" };
}

function readOptions(argv: readonly string[]): ReturnType<typeof parseOptions> {
	try {
		return parseOptions(argv);
	} catch (error) {
		throw new BootstrapUsageError(error instanceof Error ? error.message : "Invalid command line");
	}
}

function parseOptions(argv: readonly string[]): ReturnType<typeof parseArgs<{ options: typeof OPTION_DEFINITIONS }>>["values"] {
	return parseArgs({ args: [...argv], options: OPTION_DEFINITIONS, strict: true, allowPositionals: false }).values;
}
