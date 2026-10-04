import { Readable } from "node:stream";

import { describe, expect, it, vi } from "vitest";

import { StdinPasswordReader, type PasswordReader } from "./password-reader";
import { BootstrapUsageError, BootstrapEmailTakenError, SuperAdminAlreadyExistsError, SuperAdminRoleMissingError } from "./superadmin-bootstrap.errors";
import { SuperAdminBootstrapCommand, type BootstrapCommandPorts } from "./superadmin-bootstrap.command";
import { BOOTSTRAP_EXIT_CODES } from "./superadmin-bootstrap.constants";
import type { BootstrapOutcome, BootstrapRequest } from "./superadmin-bootstrap.service";

const PASSWORD = "Corr3ct-Horse-Battery!";
const ARGV = ["--email", "root@acme.test", "--full-name", "Root Admin", "--password-stdin"];
const OUTCOME: BootstrapOutcome = { userId: "user-1", email: "root@acme.test", fullName: "Root Admin" };
const LOGIN_URL = "https://admin.acme.test";

interface Setup {
	readonly command: SuperAdminBootstrapCommand;
	readonly logs: string[];
	readonly bootstrap: ReturnType<typeof vi.fn<(request: BootstrapRequest) => Promise<BootstrapOutcome>>>;
	readonly createPasswordReader: ReturnType<typeof vi.fn<BootstrapCommandPorts["createPasswordReader"]>>;
}

function setup(password: string = PASSWORD): Setup {
	const logs: string[] = [];
	const bootstrap = vi.fn<(request: BootstrapRequest) => Promise<BootstrapOutcome>>().mockResolvedValue(OUTCOME);
	const createPasswordReader = vi
		.fn<BootstrapCommandPorts["createPasswordReader"]>()
		.mockImplementation((): PasswordReader => new StdinPasswordReader(Readable.from([`${password}\n`])));
	const command = new SuperAdminBootstrapCommand({ createPasswordReader, bootstrap, loginUrl: (): string => LOGIN_URL, log: (line: string): void => void logs.push(line) });
	return { command, logs, bootstrap, createPasswordReader };
}

describe("SuperAdminBootstrapCommand", () => {
	it("bootstraps with the validated identity and password, prints the next steps, and never prints the password", async () => {
		const { command, logs, bootstrap } = setup();

		const exitCode = await command.execute(ARGV);

		expect(exitCode).toBe(BOOTSTRAP_EXIT_CODES.success);
		expect(bootstrap).toHaveBeenCalledWith({ identity: { email: "root@acme.test", fullName: "Root Admin" }, password: PASSWORD });
		const output = logs.join("\n");
		expect(output).toContain(LOGIN_URL);
		expect(output).toMatch(/two-factor authentication/);
		expect(output).toContain("root@acme.test");
		expect(output).not.toContain(PASSWORD);
	});

	it("selects the reader from the flag", async () => {
		const prompt = setup();
		const stdin = setup();

		await prompt.command.execute(["--email", "root@acme.test", "--full-name", "Root Admin"]);
		await stdin.command.execute(ARGV);

		expect(prompt.createPasswordReader).toHaveBeenCalledWith("prompt");
		expect(stdin.createPasswordReader).toHaveBeenCalledWith("stdin");
	});

	it("rejects a password that fails signup's policy BEFORE touching the database, without echoing it", async () => {
		const weak = "weakpassword";
		const { command, logs, bootstrap } = setup(weak);

		const exitCode = await command.execute(ARGV);

		expect(exitCode).toBe(BOOTSTRAP_EXIT_CODES.usage);
		expect(bootstrap).not.toHaveBeenCalled();
		expect(logs.join("\n")).toMatch(/password policy/);
		expect(logs.join("\n")).not.toContain(weak);
	});

	it("rejects an empty stdin", async () => {
		const { command, bootstrap } = setup("");

		expect(await command.execute(ARGV)).toBe(BOOTSTRAP_EXIT_CODES.usage);
		expect(bootstrap).not.toHaveBeenCalled();
	});

	it("exits with the usage code and never reads a password when the arguments are invalid", async () => {
		const { command, createPasswordReader, bootstrap } = setup();

		expect(await command.execute(["--email", "bad"])).toBe(BOOTSTRAP_EXIT_CODES.usage);
		expect(await command.execute([...ARGV, "--password", "hunter2"])).toBe(BOOTSTRAP_EXIT_CODES.usage);
		expect(createPasswordReader).not.toHaveBeenCalled();
		expect(bootstrap).not.toHaveBeenCalled();
	});

	it("exits with the usage code when no terminal is attached for the prompt", async () => {
		const { command, createPasswordReader, bootstrap } = setup();
		createPasswordReader.mockImplementation(() => {
			throw new BootstrapUsageError("No terminal is attached");
		});

		expect(await command.execute(["--email", "root@acme.test", "--full-name", "Root Admin"])).toBe(BOOTSTRAP_EXIT_CODES.usage);
		expect(bootstrap).not.toHaveBeenCalled();
	});

	it("prints usage and succeeds for --help", async () => {
		const { command, logs, bootstrap } = setup();

		expect(await command.execute(["--help"])).toBe(BOOTSTRAP_EXIT_CODES.success);
		expect(logs.join("\n")).toContain("Usage:");
		expect(bootstrap).not.toHaveBeenCalled();
	});

	it.each([
		["a SuperAdmin already exists", new SuperAdminAlreadyExistsError(), BOOTSTRAP_EXIT_CODES.refused, /Refused: .*already exists/],
		["the email is taken", new BootstrapEmailTakenError(), BOOTSTRAP_EXIT_CODES.refused, /Refused/],
		["the role catalog is not loaded", new SuperAdminRoleMissingError(), BOOTSTRAP_EXIT_CODES.notReady, /Not ready: .*reference data/],
	])("exits non-zero with a clear message when %s", async (_label: string, error: Error, exitCode: number, message: RegExp) => {
		const { command, logs, bootstrap } = setup();
		bootstrap.mockRejectedValue(error);

		expect(await command.execute(ARGV)).toBe(exitCode);
		expect(logs.join("\n")).toMatch(message);
		expect(logs.join("\n")).not.toContain(PASSWORD);
	});

	it("rethrows an unexpected failure for the entry point to report", async () => {
		const { command, bootstrap } = setup();
		bootstrap.mockRejectedValue(new Error("connection refused"));

		await expect(command.execute(ARGV)).rejects.toThrow("connection refused");
	});
});
