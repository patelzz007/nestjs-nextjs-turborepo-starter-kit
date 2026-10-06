// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import type { LoginFormProps } from "@workspace/client/lib/auth/forms/login-form";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MERCHANT_DEMO_ACCOUNTS } from "@/lib/auth/demo-account-list";
import { ROUTES } from "@/lib/routes";

import MerchantLoginPage from "./page";

const { loginForm, serverEnvMock } = vi.hoisted(() => ({
	loginForm: vi.fn<(props: LoginFormProps) => null>(() => null),
	serverEnvMock: { NODE_ENV: "development", COOKIE_DOMAIN: undefined },
}));

// The client form is replaced by a probe: this suite checks what the server hands it.
vi.mock("@workspace/client/lib/auth/forms/login-form", () => ({ LoginForm: loginForm }));
vi.mock("@workspace/ui/components/auth-layout", () => ({
	AuthLayout: ({ children }: { readonly children: React.ReactNode }): React.JSX.Element => <>{children}</>,
}));
vi.mock("@/lib/env/env.server", () => ({ serverEnv: serverEnvMock }));

async function renderPage(query: Record<string, string | string[] | undefined>): Promise<LoginFormProps | undefined> {
	render(await MerchantLoginPage({ searchParams: Promise.resolve(query) }));
	return loginForm.mock.lastCall?.[0];
}

afterEach((): void => {
	cleanup();
	loginForm.mockClear();
	serverEnvMock.NODE_ENV = "development";
});

describe("MerchantLoginPage", () => {
	it("hands the seeded merchant demo logins to the client in development", async () => {
		expect((await renderPage({}))?.demoAccounts).toEqual(MERCHANT_DEMO_ACCOUNTS);
	});

	it.each(["production", "test"])("hands no demo credentials to the client in %s", async (nodeEnv: string) => {
		serverEnvMock.NODE_ENV = nodeEnv;

		expect((await renderPage({}))?.demoAccounts).toBeUndefined();
	});

	it("follows an allowed ?redirect= and falls back to the portal home for anything else", async () => {
		expect((await renderPage({ redirect: ROUTES.account }))?.redirectPath).toBe(ROUTES.account);
		expect((await renderPage({ redirect: "https://evil.example" }))?.redirectPath).toBe(ROUTES.home);
		expect((await renderPage({ redirect: [ROUTES.account, ROUTES.home] }))?.redirectPath).toBe(ROUTES.home);
	});

	it("prefills only a valid ?email=", async () => {
		expect((await renderPage({ email: "owner@example.com" }))?.defaultEmail).toBe("owner@example.com");
		expect((await renderPage({ email: "not-an-email" }))?.defaultEmail).toBeUndefined();
	});
});
