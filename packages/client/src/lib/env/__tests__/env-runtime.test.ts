import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveProcessExit } from "../env-runtime";

vi.mock("server-only", () => ({}));

describe("resolveProcessExit", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.restoreAllMocks();
	});

	it("should give process.exit in the Node.js runtime", () => {
		vi.stubEnv("NEXT_RUNTIME", "nodejs");
		vi.spyOn(process, "exit").mockImplementation((code) => {
			throw new Error(`process.exit(${String(code)})`);
		});
		expect(() => resolveProcessExit()?.(1)).toThrow("process.exit(1)");
	});

	it("should give nothing in the Edge runtime and outside Next", () => {
		vi.stubEnv("NEXT_RUNTIME", "edge");
		expect(resolveProcessExit()).toBeUndefined();
		vi.stubEnv("NEXT_RUNTIME", "");
		expect(resolveProcessExit()).toBeUndefined();
	});
});
