// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { AppLanguage } from "@workspace/shared";
import { ShellLanguageToggle } from "@workspace/ui/components/shell-language-toggle";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** What the stubbed session answers: signed in or not, and the language saved on the profile. */
interface AuthStub {
	isAuthenticated: boolean;
	saved: AppLanguage | undefined;
	readonly save: (input: { readonly language: AppLanguage }) => void;
}

const { router, auth } = vi.hoisted(() => {
	const stub: AuthStub = { isAuthenticated: true, saved: undefined, save: vi.fn() };
	return { router: { refresh: vi.fn() }, auth: stub };
});
vi.mock("next/navigation", () => ({ useRouter: (): { readonly refresh: () => void } => router }));
vi.mock("../../index", () => ({
	useAuth: (): object => ({
		isAuthenticated: auth.isAuthenticated,
		api: {
			auth: {
				profile: { useQuery: (): object => ({ data: auth.saved === undefined ? undefined : { data: { language: auth.saved } } }) },
				setLanguage: { useMutation: (): object => ({ mutate: auth.save }) },
			},
		},
	}),
}));

const { AppLanguageProvider } = await import("../../../../i18n/app-language-provider");
const { ProfileLanguageSync } = await import("../profile-language-sync");

/** A cookie reader that answers `cookies`. */
function cookiesOf(cookies: string): () => string {
	return (): string => cookies;
}

function renderSync(cookies: string): void {
	const readCookies = cookiesOf(cookies);
	render(
		<AppLanguageProvider language="en">
			<ProfileLanguageSync readCookies={readCookies} />
			<ShellLanguageToggle />
		</AppLanguageProvider>,
	);
}

beforeEach((): void => {
	auth.isAuthenticated = true;
	auth.saved = "en";
});

afterEach((): void => {
	cleanup();
	vi.clearAllMocks();
	document.cookie = "lang=; path=/; max-age=0";
});

describe("ProfileLanguageSync (enhancement 5.2)", () => {
	it("saves a language chosen while signed in on the profile", async () => {
		renderSync("lang=en");
		fireEvent.click(screen.getByRole("button", { name: "Choose language" }));
		fireEvent.click(await screen.findByRole("menuitemradio", { name: "தமிழ்" }));
		expect(auth.save).toHaveBeenCalledWith({ language: "ta" });
	});

	it("applies the saved language after sign-in on a device that hasn't chosen one, without saving it again", () => {
		auth.saved = "zh-Hans";
		renderSync("");
		expect(document.cookie).toContain("lang=zh-Hans");
		expect(router.refresh).toHaveBeenCalledTimes(1);
		expect(auth.save).not.toHaveBeenCalled();
	});

	it("leaves a device's own choice alone", () => {
		auth.saved = "ms";
		renderSync("lang=en");
		expect(router.refresh).not.toHaveBeenCalled();
	});

	it("does nothing while signed out", () => {
		auth.isAuthenticated = false;
		auth.saved = "ms";
		renderSync("");
		expect(router.refresh).not.toHaveBeenCalled();
	});
});
