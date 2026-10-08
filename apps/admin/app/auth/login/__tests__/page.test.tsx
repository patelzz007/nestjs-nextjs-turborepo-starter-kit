// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { LIST_SLOT_INDEX } from "@workspace/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { LoginViewProps } from "../login-view";
import AdminLoginPage from "../page";

const { loginView, serverEnvMock } = vi.hoisted(() => ({
	loginView: vi.fn<(props: LoginViewProps) => null>(() => null),
	serverEnvMock: { NODE_ENV: "development", COOKIE_DOMAIN: undefined },
}));

// The client view is replaced by a probe: this suite checks what the server hands it.
vi.mock("../login-view", () => ({ LoginView: loginView }));
vi.mock("@/lib/env/env.server", () => ({ serverEnv: serverEnvMock }));

async function renderPage(query: Record<string, string | string[] | undefined>): Promise<LoginViewProps | undefined> {
	render(await AdminLoginPage({ searchParams: Promise.resolve(query) }));
	return loginView.mock.lastCall?.[LIST_SLOT_INDEX.first];
}

afterEach(() => {
	cleanup();
	loginView.mockClear();
	serverEnvMock.NODE_ENV = "development";
});

describe("AdminLoginPage", () => {
	it("hands the seeded demo logins to the client in development", async () => {
		const demoAccounts = (await renderPage({}))?.demoAccounts ?? [];
		expect(demoAccounts.map((account) => account.email)).toEqual(["superadmin@example.com", "admin@example.com"]);
	});

	it.each(["production", "test"])("hands no demo credentials to the client in %s", async (nodeEnv: string) => {
		serverEnvMock.NODE_ENV = nodeEnv;
		expect((await renderPage({}))?.demoAccounts).toEqual([]);
	});

	it("passes a safe ?redirect= through normalized", async () => {
		expect((await renderPage({ redirect: "/users/./?page=2" }))?.redirectPath).toBe("/users/?page=2");
	});

	it.each(["/%5Cevil.com", "/\\evil.com", "/\t/evil.com", "//evil.com", "https://evil.com", "/auth/login"])(
		"falls back to the panel home for %s",
		async (redirect: string) => {
			expect((await renderPage({ redirect }))?.redirectPath).toBe("/");
		},
	);

	it("ignores a repeated ?redirect=", async () => {
		expect((await renderPage({ redirect: ["/users", "/merchants"] }))?.redirectPath).toBe("/");
	});
});
