import type { NodeEnv } from "@workspace/shared";
import { describe, expect, it, vi } from "vitest";

import { areDemoAccountsVisible, resolveDemoAccounts } from "./demo-accounts-policy";
import type { DemoAccount } from "./login-form-types";

const ACCOUNTS: readonly DemoAccount[] = [{ label: "Admin", email: "admin@example.com", password: "Admin@123" }];

const NON_DEVELOPMENT_ENVS: readonly NodeEnv[] = ["production", "test"];

describe("areDemoAccountsVisible", () => {
	it("is true in development only", () => {
		expect(areDemoAccountsVisible("development")).toBe(true);
		expect(areDemoAccountsVisible("production")).toBe(false);
		expect(areDemoAccountsVisible("test")).toBe(false);
	});
});

describe("resolveDemoAccounts", () => {
	it("returns the loaded accounts in development", async () => {
		expect(await resolveDemoAccounts("development", () => Promise.resolve(ACCOUNTS))).toEqual(ACCOUNTS);
	});

	it.each(NON_DEVELOPMENT_ENVS)("returns none and never calls the loader in %s", async (nodeEnv: NodeEnv) => {
		const load = vi.fn<() => Promise<readonly DemoAccount[]>>(() => Promise.resolve(ACCOUNTS));

		expect(await resolveDemoAccounts(nodeEnv, load)).toEqual([]);
		expect(load).not.toHaveBeenCalled();
	});
});
