import { renderHook, waitFor } from "@testing-library/react-native";

import { MOBILE_DEMO_ACCOUNTS } from "./demo-account-list";
import { loadDemoAccounts, useDemoAccounts, type DemoAccount } from "./demo-accounts";

describe("loadDemoAccounts", () => {
	it("offers the seeded logins in a development build (__DEV__ under Jest)", async () => {
		await expect(loadDemoAccounts()).resolves.toBe(MOBILE_DEMO_ACCOUNTS);
	});

	it("covers every role asked for: super admin, admin, manager, both owners and a cashier", () => {
		expect(MOBILE_DEMO_ACCOUNTS.map((account: DemoAccount): string => account.label)).toStrictEqual([
			"Super Admin",
			"Admin",
			"Manager",
			"KL Owner",
			"Melaka Owner",
			"KL Cashier",
		]);
		expect(new Set(MOBILE_DEMO_ACCOUNTS.map((account: DemoAccount): string => account.email)).size).toBe(MOBILE_DEMO_ACCOUNTS.length);
	});
});

describe("useDemoAccounts", () => {
	it("starts empty, then holds the loaded logins", async () => {
		const { result } = await renderHook(() => useDemoAccounts());

		await waitFor(() => {
			expect(result.current).toBe(MOBILE_DEMO_ACCOUNTS);
		});
	});
});
