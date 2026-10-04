import { describe, expect, it } from "vitest";

import { BootstrapPasswordSchema, formatBootstrapUsage, parseBootstrapArgs } from "./superadmin-bootstrap.args";
import { FULL_NAME_MAX_LENGTH } from "./superadmin-bootstrap.constants";
import { BootstrapUsageError } from "./superadmin-bootstrap.errors";

describe("parseBootstrapArgs", () => {
	it("reads --flag value and --flag=value, and defaults to the no-echo prompt", () => {
		const expected = { kind: "run", identity: { email: "root@acme.test", fullName: "Root Admin" }, passwordSource: "prompt" };

		expect(parseBootstrapArgs(["--email", "root@acme.test", "--full-name", "Root Admin"])).toEqual(expected);
		expect(parseBootstrapArgs(["--email=root@acme.test", "--full-name=Root Admin"])).toEqual(expected);
	});

	it("canonicalises the email exactly like signup (lower case)", () => {
		const command = parseBootstrapArgs(["--email", "Root@Acme.TEST", "--full-name", "Root Admin"]);

		expect(command).toMatchObject({ kind: "run", identity: { email: "root@acme.test" } });
	});

	it("selects stdin only when --password-stdin is given", () => {
		const command = parseBootstrapArgs(["--email", "root@acme.test", "--full-name", "Root Admin", "--password-stdin"]);

		expect(command).toMatchObject({ kind: "run", passwordSource: "stdin" });
	});

	it("tolerates the `--` separator some package managers forward", () => {
		expect(parseBootstrapArgs(["--", "--email", "root@acme.test", "--full-name", "Root Admin"])).toMatchObject({ kind: "run" });
	});

	it("returns help without requiring the other flags", () => {
		expect(parseBootstrapArgs(["--help"])).toEqual({ kind: "help" });
	});

	it.each([["--password", "hunter2"], ["--password=hunter2"], ["--pass", "hunter2"], ["--pwd=hunter2"]])(
		"refuses a password on argv (%s) and never echoes the value",
		(...password: string[]) => {
			const args = ["--email", "root@acme.test", "--full-name", "Root Admin", ...password];

			expect(() => parseBootstrapArgs(args)).toThrow(BootstrapUsageError);
			expect(() => parseBootstrapArgs(args)).toThrow(/shell history and the process list/);
			expect(() => parseBootstrapArgs(args)).not.toThrow(/hunter2/);
		},
	);

	it.each([
		["missing email", ["--full-name", "Root Admin"]],
		["missing full name", ["--email", "root@acme.test"]],
		["invalid email", ["--email", "not-an-email", "--full-name", "Root Admin"]],
		["email with surrounding whitespace", ["--email", " root@acme.test", "--full-name", "Root Admin"]],
		["one-character name", ["--email", "root@acme.test", "--full-name", "R"]],
		["name longer than the column", ["--email", "root@acme.test", "--full-name", "x".repeat(FULL_NAME_MAX_LENGTH + 1)]],
		["unknown flag", ["--email", "root@acme.test", "--full-name", "Root Admin", "--role", "Admin"]],
		["flag without a value", ["--email", "--full-name", "Root Admin"]],
		["positional argument", ["root@acme.test"]],
	])("rejects %s with a usage error", (_label: string, args: string[]) => {
		expect(() => parseBootstrapArgs(args)).toThrow(BootstrapUsageError);
	});

	it("documents the safe password options and no inline one", () => {
		const usage = formatBootstrapUsage();

		expect(usage).toContain("--password-stdin");
		expect(usage).not.toMatch(/--password\s/);
	});
});

describe("BootstrapPasswordSchema", () => {
	it("is the signup password policy", () => {
		expect(BootstrapPasswordSchema.safeParse("Corr3ct-Horse-Battery!").success).toBe(true);
		expect(BootstrapPasswordSchema.safeParse("short").success).toBe(false);
		expect(BootstrapPasswordSchema.safeParse("alllowercasenodigits").success).toBe(false);
		expect(BootstrapPasswordSchema.safeParse("").success).toBe(false);
	});
});
