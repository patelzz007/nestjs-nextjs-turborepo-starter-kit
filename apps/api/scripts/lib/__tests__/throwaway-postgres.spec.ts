import { describe, expect, it } from "vitest";

import {
	dockerRunArgs,
	parsePublishedPort,
	readinessArgs,
	startThrowawayPostgres,
	THROWAWAY_POSTGRES_IMAGE,
	throwawayDatabaseUrl,
	ThrowawayPostgresError,
	type CommandResult,
} from "../throwaway-postgres";

const OK: CommandResult = { status: 0, stdout: "", stderr: "" };
const FAILED: CommandResult = { status: 1, stdout: "", stderr: "no such container" };
const PUBLISHED_PORT = 55012;

async function noWait(): Promise<void> {
	await Promise.resolve();
}

/** A fake `docker` that records its calls; `ready` says on which readiness probe the server answers. */
function fakeDocker(ready: number, runResult: CommandResult = OK): { calls: string[][]; run: (command: string, args: readonly string[]) => CommandResult } {
	const calls: string[][] = [];
	let probes = 0;
	return {
		calls,
		run: (_command: string, args: readonly string[]): CommandResult => {
			calls.push([...args]);
			const [verb] = args;
			if (verb === "run") {
				return runResult;
			}
			if (verb === "exec") {
				probes += 1;
				return probes >= ready ? OK : FAILED;
			}
			if (verb === "port") {
				return { status: 0, stdout: `127.0.0.1:${String(PUBLISHED_PORT)}\n`, stderr: "" };
			}
			return OK;
		},
	};
}

describe("throwaway PostgreSQL", () => {
	it("runs a removable container published on loopback only", () => {
		const args = dockerRunArgs("snap", "secret");
		expect(args).toContain("--rm");
		expect(args).toContain("127.0.0.1::5432");
		expect(args).toContain("POSTGRES_PASSWORD=secret");
		expect(args.at(-1)).toBe(THROWAWAY_POSTGRES_IMAGE);
	});

	it("waits for a TCP connection, not the init-time socket", () => {
		expect(readinessArgs("snap")).toContain("--host");
		expect(readinessArgs("snap")).toContain("127.0.0.1");
	});

	it("reads the published port and builds the URL", () => {
		expect(parsePublishedPort("127.0.0.1:55012\n")).toBe(PUBLISHED_PORT);
		expect((): number => parsePublishedPort("")).toThrow();
		expect(throwawayDatabaseUrl(PUBLISHED_PORT, "pw")).toBe("postgresql://postgres:pw@127.0.0.1:55012/security_snapshot");
	});

	it("starts, waits until ready, and removes the container on stop", async () => {
		const docker = fakeDocker(3);
		const server = await startThrowawayPostgres(docker.run, noWait);
		expect(server.databaseUrl).toMatch(/@127\.0\.0\.1:55012\/security_snapshot$/u);
		expect(docker.calls.filter(([verb]) => verb === "exec")).toHaveLength(3);
		server.stop();
		expect(docker.calls.at(-1)?.slice(0, 2)).toStrictEqual(["rm", "--force"]);
	});

	it("fails clearly when Docker cannot start the container", async () => {
		await expect(startThrowawayPostgres(fakeDocker(1, FAILED).run, noWait)).rejects.toThrow(ThrowawayPostgresError);
	});

	it("removes the container when it never becomes ready", async () => {
		const docker = fakeDocker(Number.POSITIVE_INFINITY);
		await expect(startThrowawayPostgres(docker.run, noWait)).rejects.toThrow(/did not accept connections/u);
		expect(docker.calls.at(-1)?.slice(0, 2)).toStrictEqual(["rm", "--force"]);
	});
});
