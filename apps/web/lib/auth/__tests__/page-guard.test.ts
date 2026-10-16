import { afterEach, describe, expect, it, vi } from "vitest";

import { guardWebPage } from "@/lib/auth/page-guard";
import { loginPath, ROUTES, walletClaimPath } from "@/lib/routes";
import { RedirectSignal } from "@/test-support/navigation";

interface CookieStore {
	readonly get: (name: string) => { readonly value: string } | undefined;
}

const { cookiesMock } = vi.hoisted(() => ({ cookiesMock: vi.fn<() => Promise<CookieStore>>() }));

vi.mock("next/headers", () => ({ cookies: (): Promise<CookieStore> => cookiesMock() }));
vi.mock("next/navigation", async (importOriginal) => {
	const { withNavigationSignals } = await import("@/test-support/navigation");
	return withNavigationSignals(await importOriginal<typeof import("next/navigation")>());
});

/** 2100-01-01T00:00:00Z in epoch seconds — an `exp` that never passes during the suite. */
const FAR_FUTURE_EXP_SECONDS = 4_102_444_800;

/** An unsigned JWT whose `exp` is far in the future, so the access token looks live. */
const LIVE_ACCESS_TOKEN = `e30.${Buffer.from(JSON.stringify({ exp: FAR_FUTURE_EXP_SECONDS })).toString("base64url")}.sig`;

function browserSends(cookies: Readonly<Record<string, string>>): void {
	cookiesMock.mockResolvedValue({
		get: (name: string): { readonly value: string } | undefined => {
			const value = cookies[name];
			return value === undefined ? undefined : { value };
		},
	});
}

async function redirectOf(returnPath: string): Promise<string | undefined> {
	try {
		await guardWebPage(returnPath);
		return undefined;
	} catch (error: unknown) {
		if (error instanceof RedirectSignal) {
			return error.url;
		}
		throw error;
	}
}

afterEach((): void => {
	cookiesMock.mockReset();
});

describe("guardWebPage (server-side page guard)", () => {
	it("lets the page render when the browser sent an access token and a refresh token", async () => {
		browserSends({ accessToken: LIVE_ACCESS_TOKEN, refreshToken: "refresh" });

		await expect(redirectOf(ROUTES.rewardHub.wallet)).resolves.toBeUndefined();
	});

	it("sends a visitor without cookies to sign-in, returning to the page afterwards", async () => {
		browserSends({});

		await expect(redirectOf(ROUTES.rewardHub.wallet)).resolves.toBe(loginPath(ROUTES.rewardHub.wallet));
	});

	it("keeps the dynamic segment in the return path", async () => {
		browserSends({});
		const claimPath = walletClaimPath("00000000-0000-4000-8000-000000000001");

		await expect(redirectOf(claimPath)).resolves.toBe(loginPath(claimPath));
	});

	it("redirects a refresh-only session, so the login route's proxy refresh can restore it", async () => {
		browserSends({ refreshToken: "refresh" });

		await expect(redirectOf(ROUTES.rewardHub.activity)).resolves.toBe(loginPath(ROUTES.rewardHub.activity));
	});

	it("redirects an orphaned access token (no refresh token)", async () => {
		browserSends({ accessToken: LIVE_ACCESS_TOKEN });

		await expect(redirectOf(ROUTES.rewardHub.account)).resolves.toBe(loginPath(ROUTES.rewardHub.account));
	});
});
