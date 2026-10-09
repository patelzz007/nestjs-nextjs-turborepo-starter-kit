import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { APP_LINKS } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import {
	childPath,
	isPathWithin,
	landingSectionPath,
	LANDING_SECTION_IDS,
	loginPath,
	publicRewardDetailPath,
	rewardDetailPath,
	ROUTE_PREFIXES,
	ROUTES,
	verifyEmailPath,
	walletClaimPath,
} from "@/lib/routes";
import { listAppPageRoutes, resolvesToAppPage } from "@/test-support/app-routes";

const APP_PAGE_ROUTES = listAppPageRoutes();

/**
 * Every static page path in `ROUTES`, listed explicitly. The key-count
 * assertions below fail when an entry is added, so this list cannot silently
 * fall behind the module.
 */
const AUTH_PAGE_PATHS: readonly string[] = [ROUTES.auth.login, ROUTES.auth.signup, ROUTES.auth.forgotPassword, ROUTES.auth.resetPassword, ROUTES.auth.verifyEmail];
const REWARD_HUB_PAGE_PATHS: readonly string[] = [
	ROUTES.rewardHub.browse,
	ROUTES.rewardHub.wallet,
	ROUTES.rewardHub.activity,
	ROUTES.rewardHub.referrals,
	ROUTES.rewardHub.account,
];
const STATIC_PAGE_PATHS: readonly string[] = [ROUTES.home, ROUTES.hello, ...AUTH_PAGE_PATHS, ...REWARD_HUB_PAGE_PATHS];

describe("ROUTES", () => {
	it("is fully covered by the page-existence guard below", () => {
		expect(Object.keys(ROUTES).sort()).toEqual(["auth", "hello", "home", "rewardHub"]);
		expect(Object.keys(ROUTES.auth)).toHaveLength(AUTH_PAGE_PATHS.length);
		expect(Object.keys(ROUTES.rewardHub)).toHaveLength(REWARD_HUB_PAGE_PATHS.length);
	});

	it.each(STATIC_PAGE_PATHS)("%s renders an existing app/**/page.tsx", (path: string) => {
		expect(resolvesToAppPage(path, APP_PAGE_ROUTES)).toBe(true);
	});

	it("has no two static entries pointing at the same page", () => {
		expect(new Set(STATIC_PAGE_PATHS).size).toBe(STATIC_PAGE_PATHS.length);
	});

	it("keeps the signed-in app under /rewardhub with plural, kebab-case paths", () => {
		expect(ROUTES.rewardHub).toEqual({
			browse: "/rewardhub",
			wallet: "/rewardhub/wallet",
			activity: "/rewardhub/activity",
			referrals: "/rewardhub/referrals",
			account: "/rewardhub/account",
		});
	});

	it("serves the paths the API emails link to exactly where the app renders them", () => {
		expect(ROUTES.home).toBe(APP_LINKS.web.home);
		expect(ROUTES.rewardHub.browse).toBe(APP_LINKS.web.rewardHub);
		expect(ROUTES.rewardHub.wallet).toBe(APP_LINKS.web.wallet);
		expect(ROUTES.rewardHub.account).toBe(APP_LINKS.web.account);
		expect(ROUTES.auth.login).toBe(APP_LINKS.auth.login);
		expect(ROUTES.auth.verifyEmail).toBe(APP_LINKS.auth.verifyEmail);
		expect(ROUTES.auth.resetPassword).toBe(APP_LINKS.auth.resetPassword);
		expect(ROUTES.auth.forgotPassword).toBe(APP_LINKS.auth.forgotPassword);
	});
});

describe("route builders", () => {
	it("build detail pages that exist", () => {
		const built: readonly string[] = [rewardDetailPath("reward-1"), publicRewardDetailPath("reward-1"), walletClaimPath("claim-1")];
		for (const href of built) {
			expect(resolvesToAppPage(href, APP_PAGE_ROUTES)).toBe(true);
		}
	});

	it("put signed-in reward detail under /rewardhub/rewards and claims under the wallet", () => {
		expect(rewardDetailPath("reward-1")).toBe("/rewardhub/rewards/reward-1");
		expect(publicRewardDetailPath("reward-1")).toBe("/rewards/reward-1");
		expect(walletClaimPath("claim-1")).toBe("/rewardhub/wallet/claim-1");
	});

	it("encode dynamic segments so an id can never escape its parent path", () => {
		expect(childPath(ROUTE_PREFIXES.rewardHubRewards, "a/b?c")).toBe("/rewardhub/rewards/a%2Fb%3Fc");
		expect(walletClaimPath("../account")).toBe("/rewardhub/wallet/..%2Faccount");
	});

	it("build the login page with an optional, encoded return path", () => {
		expect(loginPath()).toBe("/auth/login");
		expect(loginPath(ROUTES.rewardHub.browse)).toBe("/auth/login?redirect=%2Frewardhub");
		expect(loginPath(ROUTES.rewardHub.activity)).toBe("/auth/login?redirect=%2Frewardhub%2Factivity");
		expect(resolvesToAppPage(loginPath(ROUTES.rewardHub.wallet), APP_PAGE_ROUTES)).toBe(true);
	});

	it("build the verify-email page with an encoded token", () => {
		expect(verifyEmailPath("a+b/c")).toBe("/auth/verify-email?token=a%2Bb%2Fc");
		expect(resolvesToAppPage(verifyEmailPath("t"), APP_PAGE_ROUTES)).toBe(true);
	});

	it("build landing anchors on the home page", () => {
		expect(landingSectionPath(LANDING_SECTION_IDS.rewards)).toBe("/#rewards");
		expect(landingSectionPath(LANDING_SECTION_IDS.howItWorks)).toBe("/#how-it-works");
		expect(resolvesToAppPage(landingSectionPath(LANDING_SECTION_IDS.rewards), APP_PAGE_ROUTES)).toBe(true);
	});
});

describe("isPathWithin", () => {
	it("matches the prefix itself and anything below it", () => {
		expect(isPathWithin("/rewardhub", "/rewardhub")).toBe(true);
		expect(isPathWithin("/rewardhub/wallet/claim-1", "/rewardhub")).toBe(true);
		expect(isPathWithin("/rewardhub?tab=1", "/rewardhub")).toBe(true);
		expect(isPathWithin("/rewardhub#top", "/rewardhub")).toBe(true);
	});

	it("never matches a longer sibling segment or an unrelated path", () => {
		expect(isPathWithin("/rewardhubs", "/rewardhub")).toBe(false);
		expect(isPathWithin("/rewardhub-old/wallet", "/rewardhub")).toBe(false);
		expect(isPathWithin("/rewards/reward-1", "/rewardhub")).toBe(false);
		expect(isPathWithin("/", "/rewardhub")).toBe(false);
	});
});

// ── Source guard: route strings live only in lib/routes.ts ──────────────────

const APP_ROOT: string = fileURLToPath(new URL("..", import.meta.url));
const SOURCE_DIRS: readonly string[] = ["app", "components", "lib"];
const SOURCE_FILES_AT_ROOT: readonly string[] = ["proxy.ts"];
const SOURCE_FILE_PATTERN = /\.tsx?$/;
const TEST_FILE_PATTERN = /\.test\.tsx?$/;
const ROUTES_MODULE = join("lib", "routes.ts");

/** A quoted internal app path, e.g. `"/rewardhub/wallet"` or `'/auth/login'` (doc comments use backticks and are not matched). */
const ROUTE_LITERAL_PATTERN = /["']\/(?:rewardhub|rewards|auth|hello)\b/;

function listSourceFiles(directory: string, files: string[]): void {
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const fullPath = join(directory, entry.name);
		if (entry.isDirectory()) {
			listSourceFiles(fullPath, files);
		} else if (SOURCE_FILE_PATTERN.test(entry.name) && !TEST_FILE_PATTERN.test(entry.name)) {
			files.push(fullPath);
		}
	}
}

describe("route string ownership", () => {
	it("spells out internal route strings only in lib/routes.ts", () => {
		const files: string[] = SOURCE_FILES_AT_ROOT.map((file) => join(APP_ROOT, file));
		for (const directory of SOURCE_DIRS) {
			listSourceFiles(join(APP_ROOT, directory), files);
		}

		const offenders: string[] = files
			.map((file) => relative(APP_ROOT, file))
			.filter((file) => file !== ROUTES_MODULE)
			.filter((file) => ROUTE_LITERAL_PATTERN.test(readFileSync(join(APP_ROOT, file), "utf8")));

		expect(files.length).toBeGreaterThan(0);
		expect(offenders).toEqual([]);
	});
});
