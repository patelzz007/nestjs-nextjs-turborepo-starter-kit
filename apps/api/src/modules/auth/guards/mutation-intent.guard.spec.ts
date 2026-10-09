import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { MUTATION_INTENT_HEADER, MUTATION_INTENT_VALUE } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { createHttpContext, testRequest } from "../../../../test/support/http-execution-context";
import { createTestTypedConfig } from "../../../../test/support/test-api-env";
import { SKIP_MUTATION_INTENT_KEY } from "../decorators/skip-mutation-intent.decorator";
import { MutationIntentGuard } from "./mutation-intent.guard";

const config = createTestTypedConfig();
const guard = new MutationIntentGuard(new Reflector(), config);
const ALLOWED_ORIGIN: string = config.http.corsOrigins.at(0) ?? "";
/** Node lowercases incoming header names. */
const INTENT_HEADER: string = MUTATION_INTENT_HEADER.toLowerCase();

function activate(headers: Record<string, string>, method = "POST", metadata: Record<string, boolean> = {}): boolean {
	return guard.canActivate(createHttpContext(testRequest({ headers, method }), metadata));
}

describe("MutationIntentGuard", () => {
	it("lets a same-origin browser mutation with the intent header through", () => {
		expect(activate({ origin: ALLOWED_ORIGIN, [INTENT_HEADER]: MUTATION_INTENT_VALUE })).toBe(true);
	});

	it("rejects a browser mutation without the intent header", () => {
		expect(() => activate({ origin: ALLOWED_ORIGIN })).toThrow(ForbiddenException);
	});

	it("rejects a browser mutation from an origin outside the allowlist", () => {
		expect(() => activate({ origin: "https://evil.example", [INTENT_HEADER]: MUTATION_INTENT_VALUE })).toThrow(ForbiddenException);
	});

	it("exempts safe methods, bearer requests and @SkipMutationIntent routes", () => {
		expect(activate({}, "GET")).toBe(true);
		expect(activate({ authorization: "Bearer abc" })).toBe(true);
		expect(activate({}, "POST", { [SKIP_MUTATION_INTENT_KEY]: true })).toBe(true);
	});

	it("exempts client type mobile: it carries no ambient credential and a native app sends no Origin", () => {
		expect(activate({ "x-client-type": "mobile" })).toBe(true);
	});

	it.each(["web", "admin", "merchant"])("still enforces the check for browser client type %s", (clientType: string) => {
		expect(() => activate({ "x-client-type": clientType, origin: ALLOWED_ORIGIN })).toThrow(ForbiddenException);
	});
});
