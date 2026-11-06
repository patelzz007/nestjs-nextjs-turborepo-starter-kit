import { EnvValidationError } from "@workspace/shared";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { parseAppEnv } from "../parse-app-env";

const SCHEMA = z.object({ NEXT_PUBLIC_API_URL: z.url() });

describe("parseAppEnv", () => {
	it("should return the parsed values", () => {
		expect(parseAppEnv(SCHEMA, { NEXT_PUBLIC_API_URL: "http://localhost:8080" }, "web client")).toEqual({ NEXT_PUBLIC_API_URL: "http://localhost:8080" });
	});

	it("should fail with the named env error on a bad value", () => {
		expect(() => parseAppEnv(SCHEMA, { NEXT_PUBLIC_API_URL: undefined }, "web client")).toThrow(EnvValidationError);
	});
});
