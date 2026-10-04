import { describe, expect, it } from "vitest";

import { APP_LINKS } from "./app-links";

describe("APP_LINKS", () => {
	it("builds the org-scoped merchant API-keys path, encoding the slug", () => {
		expect(APP_LINKS.merchant.apiKeys("brew-bean-kl")).toBe("/orgs/brew-bean-kl/api-keys");
		expect(APP_LINKS.merchant.apiKeys("a b/c")).toBe("/orgs/a%20b%2Fc/api-keys");
		expect(APP_LINKS.merchant.terminals("a b/c")).toBe("/orgs/a%20b%2Fc/terminals");
	});

	it("links review emails to the MFA-recovery queue filtered to PENDING, in the list-query grammar", () => {
		const link = new URL(APP_LINKS.admin.mfaRecoveryPendingQueue, "https://admin.example.com");

		expect(link.pathname).toBe(APP_LINKS.admin.mfaRecoveryQueue);
		expect([...link.searchParams.entries()]).toEqual([["filter[status]", "PENDING"]]);
	});

	it("keeps every static link an absolute app path", () => {
		const paths: readonly string[] = [
			APP_LINKS.auth.login,
			APP_LINKS.auth.verifyEmail,
			APP_LINKS.auth.resetPassword,
			APP_LINKS.auth.forgotPassword,
			APP_LINKS.web.home,
			APP_LINKS.web.rewardHub,
			APP_LINKS.web.wallet,
			APP_LINKS.web.account,
			APP_LINKS.merchant.onboarding,
			APP_LINKS.merchant.teamInvite,
			APP_LINKS.admin.home,
			APP_LINKS.admin.mfaRecoveryQueue,
		];
		for (const path of paths) {
			expect(path.startsWith("/")).toBe(true);
			expect(path === "/" || !path.endsWith("/")).toBe(true);
		}
	});
});
