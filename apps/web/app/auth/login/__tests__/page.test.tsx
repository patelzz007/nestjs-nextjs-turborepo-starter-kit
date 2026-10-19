// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { LIST_SLOT_INDEX } from "@workspace/shared";
import type { LoginFormProps } from "@workspace/client/lib/contexts/identity/forms/login-form";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WEB_DEMO_ACCOUNTS } from "@/contexts/identity/lib/demo-account-list";

import { ROUTES } from "@/lib/routes";

import WebLoginPage from "../page";

const { loginForm, serverEnvMock } = vi.hoisted(() => ({
	loginForm: vi.fn<(props: LoginFormProps) => null>(() => null),
	serverEnvMock: { NODE_ENV: "development", COOKIE_DOMAIN: undefined },
}));

// The client form is replaced by a probe: this suite checks what the server hands it.
vi.mock("@workspace/client/lib/contexts/identity/forms/login-form", () => ({ LoginForm: loginForm }));
vi.mock("@workspace/ui/components/auth-layout", () => ({
	AuthLayout: ({ children }: { readonly children: React.ReactNode }): React.JSX.Element => <>{children}</>,
}));
vi.mock("@/lib/env/env.server", () => ({ serverEnv: serverEnvMock }));

async function renderPage(searchParams: Record<string, string | string[] | undefined> = {}): Promise<LoginFormProps | undefined> {
	render(await WebLoginPage({ searchParams: Promise.resolve(searchParams) }));
	return loginForm.mock.lastCall?.[LIST_SLOT_INDEX.first];
}

afterEach((): void => {
	cleanup();
	loginForm.mockClear();
	serverEnvMock.NODE_ENV = "development";
});

describe("WebLoginPage", () => {
	it("hands the seeded demo logins to the client in development", async () => {
		expect((await renderPage())?.demoAccounts).toEqual(WEB_DEMO_ACCOUNTS);
	});

	it.each(["production", "test"])("hands no demo credentials to the client in %s", async (nodeEnv: string) => {
		serverEnvMock.NODE_ENV = nodeEnv;

		expect((await renderPage())?.demoAccounts).toBeUndefined();
	});

	it("returns a member to the signed-in page that sent them to sign in", async () => {
		expect((await renderPage({ redirect: ROUTES.dashboard.account }))?.redirectPath).toBe(ROUTES.dashboard.account);
	});

	it("falls back to browsing for a missing, repeated or unsafe redirect", async () => {
		expect((await renderPage())?.redirectPath).toBe(ROUTES.dashboard.browse);
		expect((await renderPage({ redirect: [ROUTES.dashboard.account, ROUTES.home] }))?.redirectPath).toBe(ROUTES.dashboard.browse);
		expect((await renderPage({ redirect: "https://evil.example" }))?.redirectPath).toBe(ROUTES.dashboard.browse);
		expect((await renderPage({ redirect: "//evil.example/dashboard" }))?.redirectPath).toBe(ROUTES.dashboard.browse);
	});
});
