import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { apiEnvFilePath } from "../env-file";

const API_ROOT = "/repo/apps/api";

describe("apiEnvFilePath", () => {
	it("uses the API's own .env when DOTENV_PATH is unset or blank", () => {
		expect(apiEnvFilePath(API_ROOT, undefined)).toBe("/repo/apps/api/.env");
		expect(apiEnvFilePath(API_ROOT, "")).toBe("/repo/apps/api/.env");
		expect(apiEnvFilePath(API_ROOT, "   ")).toBe("/repo/apps/api/.env");
	});

	it("uses DOTENV_PATH when set, so ci:local can point the API at CI's generated env", () => {
		expect(apiEnvFilePath(API_ROOT, "/tmp/ci-local/api.env")).toBe("/tmp/ci-local/api.env");
	});

	it("resolves a relative DOTENV_PATH against the working directory, as dotenv does", () => {
		expect(apiEnvFilePath(API_ROOT, ".artifacts/ci/api.env")).toBe(resolve(process.cwd(), ".artifacts/ci/api.env"));
	});
});
