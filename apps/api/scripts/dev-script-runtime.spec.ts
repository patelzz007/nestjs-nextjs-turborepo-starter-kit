import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import { z } from "zod";

/**
 * `pnpm dev` runs `rspack --watch`, i.e. rspack's BUILD command, which sets
 * `process.env.NODE_ENV = "production"` when it is unset — and the API child
 * process (RunScriptWebpackPlugin) inherits that, before `dotenv` can read
 * NODE_ENV from apps/api/.env (dotenv never overrides a set variable). Without
 * an explicit `--node-env development` the "dev" API silently runs as
 * production: production cookies, Swagger policy, logger defaults, etc.
 */
const PackageScriptsSchema = z.object({ scripts: z.object({ dev: z.string(), build: z.string() }) });

const packageJsonPath: string = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "package.json");

function scripts(): z.output<typeof PackageScriptsSchema>["scripts"] {
	return PackageScriptsSchema.parse(JSON.parse(readFileSync(packageJsonPath, "utf8"))).scripts;
}

function argsOf(command: string): string[] {
	return command.split(/\s+/);
}

describe("API dev/build scripts", () => {
	it("runs the watch-mode dev API with NODE_ENV=development", () => {
		const args: string[] = argsOf(scripts().dev);
		expect(args).toContain("--watch");
		expect(args[args.indexOf("--node-env") + 1]).toBe("development");
		expect(args[args.indexOf("--mode") + 1]).toBe("development");
	});

	it("leaves the production build to rspack's production default", () => {
		const args: string[] = argsOf(scripts().build);
		expect(args[args.indexOf("--mode") + 1]).toBe("production");
		expect(args).not.toContain("--node-env");
	});
});
