import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import { z } from "zod";

/** Every package script that runs `scripts/db.ts` or `scripts/dev.ts` names a command the CLI defines. */
const apiDir: string = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const PackageScriptsSchema = z.object({ scripts: z.record(z.string(), z.string()) });
const CLI_CALL = /tsx scripts\/(?<cli>db|dev)\.ts (?<command>[a-z-]+)/u;

/** The `(cli, command)` pair each package script runs, if it runs one. */
function cliCalls(): readonly { readonly script: string; readonly cli: string; readonly command: string }[] {
	const { scripts } = PackageScriptsSchema.parse(JSON.parse(readFileSync(path.join(apiDir, "package.json"), "utf8")));
	return Object.entries(scripts).flatMap(([script, line]) => {
		const groups = CLI_CALL.exec(line)?.groups;
		return groups?.cli === undefined || groups.command === undefined ? [] : [{ script, cli: groups.cli, command: groups.command }];
	});
}

describe("scripts/db.ts and scripts/dev.ts package scripts", () => {
	it("route through the two CLIs", () => {
		expect(cliCalls().map((call) => call.script)).toEqual(
			expect.arrayContaining(["db:schema", "db:apply-security", "db:check-drift", "db:check-seed-coverage", "mail:latest", "dev:tunnel", "github:webhook-tunnel"]),
		);
	});

	it.each(cliCalls())("$script runs a command $cli.ts defines ($command)", ({ cli, command }) => {
		expect(readFileSync(path.join(apiDir, "scripts", `${cli}.ts`), "utf8")).toContain(`["${command}", {`);
	});
});
