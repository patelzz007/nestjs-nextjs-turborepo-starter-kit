import { z } from "zod";

import { BootstrapPasswordSchema, formatBootstrapUsage, parseBootstrapArgs, type BootstrapCommand, PasswordSource } from "./superadmin-bootstrap.args";
import { BOOTSTRAP_EXIT_CODES } from "./superadmin-bootstrap.constants";
import { BootstrapEmailTakenError, BootstrapUsageError, SuperAdminAlreadyExistsError, SuperAdminRoleMissingError } from "./superadmin-bootstrap.errors";
import type { PasswordReader } from "./password-reader";
import type { BootstrapOutcome, BootstrapRequest } from "./superadmin-bootstrap.service";

/** The collaborators the command drives — injected so the command itself is infrastructure-free. */
export interface BootstrapCommandPorts {
	/** Builds the reader for the chosen source; throws {@link BootstrapUsageError} when it is unusable (no terminal). */
	readonly createPasswordReader: (source: PasswordSource) => PasswordReader;
	/** Connects to the platform and runs the one-time bootstrap; resolves the admin login URL for the next-steps text. */
	readonly bootstrap: (request: BootstrapRequest) => Promise<BootstrapOutcome>;
	readonly loginUrl: () => string;
	readonly log: (line: string) => void;
}

/** The next steps printed after success. Never contains the password (or anything derived from it). */
export function formatBootstrapSuccess(outcome: BootstrapOutcome, loginUrl: string): string {
	return [
		`Created the first SuperAdmin: ${outcome.fullName} <${outcome.email}> (user id ${outcome.userId}).`,
		"",
		"Next steps:",
		`  1. Log in at ${loginUrl} with this email and the password you just entered.`,
		"  2. You will be asked to enrol two-factor authentication before anything else works; finish it immediately.",
		"  3. Store the 2FA recovery codes safely, then create named staff accounts from the admin panel.",
		"",
		"This command now refuses to run again while an active SuperAdmin exists.",
	].join("\n");
}

/**
 * The command: parse → read the password → validate it with signup's policy → bootstrap → report.
 * Everything that needs no database (arguments, password source, password policy) is settled BEFORE the
 * database is touched, so a typo never opens a connection or takes the lock.
 *
 * @returns the process exit code ({@link BOOTSTRAP_EXIT_CODES})
 */
export class SuperAdminBootstrapCommand {
	public constructor(private readonly ports: BootstrapCommandPorts) {}

	public async execute(argv: readonly string[]): Promise<number> {
		try {
			const command: BootstrapCommand = parseBootstrapArgs(argv);
			if (command.kind === "help") {
				this.ports.log(formatBootstrapUsage());
				return BOOTSTRAP_EXIT_CODES.success;
			}
			const password: string = await this.readValidPassword(command.passwordSource);
			const outcome: BootstrapOutcome = await this.ports.bootstrap({ identity: command.identity, password });
			this.ports.log(formatBootstrapSuccess(outcome, this.ports.loginUrl()));
			return BOOTSTRAP_EXIT_CODES.success;
		} catch (error) {
			if (error instanceof Error) {
				return this.report(error);
			}
			throw error;
		}
	}

	private async readValidPassword(source: PasswordSource): Promise<string> {
		const password: string = await this.ports.createPasswordReader(source).read();
		const validated = BootstrapPasswordSchema.safeParse(password);
		if (!validated.success) {
			throw new BootstrapUsageError(`The password does not meet the password policy:\n${z.prettifyError(validated.error)}`);
		}
		return validated.data;
	}

	/** Maps an expected failure to a message and exit code; an unexpected one is rethrown for the entry point to print. */
	private report(error: Error): number {
		if (error instanceof BootstrapUsageError) {
			this.ports.log(`${error.message}\n\n${formatBootstrapUsage()}`);
			return BOOTSTRAP_EXIT_CODES.usage;
		}
		if (error instanceof SuperAdminAlreadyExistsError || error instanceof BootstrapEmailTakenError) {
			this.ports.log(`Refused: ${error.message}`);
			return BOOTSTRAP_EXIT_CODES.refused;
		}
		if (error instanceof SuperAdminRoleMissingError) {
			this.ports.log(`Not ready: ${error.message}`);
			return BOOTSTRAP_EXIT_CODES.notReady;
		}
		throw error;
	}
}
