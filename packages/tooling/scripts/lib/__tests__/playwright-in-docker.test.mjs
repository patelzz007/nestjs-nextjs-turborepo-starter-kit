import { describe, expect, it } from "vitest";

import { containerEnv, dockerRunArgs, forwardsArgument, forwardsOf, parseForwards, playwrightImage } from "../playwright-in-docker.mjs";

describe("playwright in docker", () => {
	it("uses the image of the installed Playwright version, and refuses anything that is not a version", () => {
		expect(playwrightImage("1.64.1")).toBe("mcr.microsoft.com/playwright:v1.64.1-noble");
		expect(() => playwrightImage("latest")).toThrow();
	});

	it("takes the --forward ports out of the arguments, the same port unless a host port follows the colon", () => {
		expect(parseForwards(["--forward", "3001", "--forward", "8080", "--project=visual", "--forward", "3001:3101", "--update-snapshots"])).toEqual({
			forwards: [
				{ containerPort: 3001, hostPort: 3101 },
				{ containerPort: 8080, hostPort: 8080 },
			],
			rest: ["--project=visual", "--update-snapshots"],
		});
		expect(() => parseForwards(["--forward"])).toThrow();
		expect(() => parseForwards(["--forward", "admin"])).toThrow();
		expect(() => parseForwards(["--forward", "70000"])).toThrow();
	});

	it("passes the forwards into the container as one argument, and reads them back there", () => {
		const forwards = [
			{ containerPort: 3001, hostPort: 3101 },
			{ containerPort: 8080, hostPort: 8080 },
		];
		expect(forwardsArgument(forwards)).toBe("3001:3101,8080:8080");
		expect(forwardsOf("3001:3101,8080:8080")).toEqual(forwards);
		expect(forwardsOf("")).toEqual([]);
	});

	it("passes only the suite's own variables, unchanged", () => {
		expect(containerEnv({ ADMIN_E2E_BASE_URL: "http://localhost:3001", HOME: "/Users/me", ADMIN_E2E_UNSET: undefined }, "ADMIN_E2E_")).toEqual([
			["ADMIN_E2E_BASE_URL", "http://localhost:3001"],
		]);
	});

	it("mounts the repository at its own path, runs as the user and reaches the host", () => {
		const args = dockerRunArgs({
			image: "mcr.microsoft.com/playwright:v1.64.1-noble",
			repoRoot: "/repo",
			workdir: "/repo/apps/admin",
			uid: 501,
			gid: 20,
			env: [["ADMIN_E2E_BASE_URL", "http://localhost:3001"]],
			command: ["node", "/repo/forward.mjs", "3001:3001", "node", "/repo/cli.js", "test"],
		});
		expect(args).toEqual([
			"run",
			"--rm",
			"--init",
			"--ipc=host",
			"--add-host",
			"host.docker.internal:host-gateway",
			"--user",
			"501:20",
			"--env",
			"HOME=/tmp",
			"--env",
			"CI=true",
			"--env",
			"ADMIN_E2E_BASE_URL=http://localhost:3001",
			"--volume",
			"/repo:/repo",
			"--workdir",
			"/repo/apps/admin",
			"mcr.microsoft.com/playwright:v1.64.1-noble",
			"node",
			"/repo/forward.mjs",
			"3001:3001",
			"node",
			"/repo/cli.js",
			"test",
		]);
	});
});
