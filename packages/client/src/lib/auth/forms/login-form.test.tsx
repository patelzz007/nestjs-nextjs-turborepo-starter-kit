// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { APP_LINKS } from "@workspace/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LoginForm } from "./login-form";

/** An idle mutation — the form only renders here, it never submits. */
interface MutationStub {
	readonly mutateAsync: () => Promise<void>;
	readonly isPending: boolean;
}

function mutationStub(): MutationStub {
	return { mutateAsync: (): Promise<void> => Promise.resolve(), isPending: false };
}

vi.mock("next/navigation", () => ({
	useRouter: (): { readonly push: () => void; readonly replace: () => void; readonly refresh: () => void } => ({
		push: (): void => undefined,
		replace: (): void => undefined,
		refresh: (): void => undefined,
	}),
}));

vi.mock("../index", () => ({
	useAuth: (): {
		readonly login: () => void;
		readonly api: {
			readonly auth: Readonly<Record<"login" | "adminLogin" | "loginTwoFactor" | "loginBackupCode" | "verifyLogin", { readonly useMutation: () => MutationStub }>>;
		};
	} => ({
		login: (): void => undefined,
		api: {
			auth: {
				login: { useMutation: mutationStub },
				adminLogin: { useMutation: mutationStub },
				loginTwoFactor: { useMutation: mutationStub },
				loginBackupCode: { useMutation: mutationStub },
				verifyLogin: { useMutation: mutationStub },
			},
		},
	}),
}));

afterEach(() => {
	cleanup();
});

describe("LoginForm forgot-password link", () => {
	it("links to the shared forgot-password page by default", () => {
		render(<LoginForm />);

		expect(screen.getByRole("link", { name: "Forgot password?" }).getAttribute("href")).toBe(APP_LINKS.auth.forgotPassword);
	});

	it("uses the given destination", () => {
		render(<LoginForm forgotPasswordHref="/help/password" />);

		expect(screen.getByRole("link", { name: "Forgot password?" }).getAttribute("href")).toBe("/help/password");
	});

	it("is hidden for an app without a password-reset flow (null)", () => {
		render(<LoginForm forgotPasswordHref={null} />);

		expect(screen.queryByRole("link", { name: "Forgot password?" })).toBeNull();
		expect(screen.getByLabelText("Password")).toBeDefined();
	});
});
