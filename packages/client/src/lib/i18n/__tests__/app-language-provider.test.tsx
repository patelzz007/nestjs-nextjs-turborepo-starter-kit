// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ShellLanguageToggle } from "@workspace/ui/components/shell-language-toggle";
import type { UiKitLanguage } from "@workspace/ui/lib/labels/language-packs";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: (): { readonly refresh: () => void } => router }));

const { AppLanguageProvider, hasLanguageCookie, languageCookieAssignment, useAppLanguageChoices } = await import("../app-language-provider");

afterEach((): void => {
	cleanup();
	router.refresh.mockClear();
	document.cookie = "lang=; path=/; max-age=0";
});

describe("languageCookieAssignment", () => {
	it("remembers the language for a year, Secure only over https", () => {
		expect(languageCookieAssignment("zh-Hans", false)).toBe("lang=zh-Hans; path=/; max-age=31536000; samesite=lax");
		expect(languageCookieAssignment("ta", true)).toBe("lang=ta; path=/; max-age=31536000; samesite=lax; secure");
	});
});

describe("AppLanguageProvider", () => {
	it("saves the language picked in the cookie and re-renders the page in it", async () => {
		render(
			<AppLanguageProvider language="en">
				<ShellLanguageToggle />
			</AppLanguageProvider>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Choose language" }));
		fireEvent.click(await screen.findByRole("menuitemradio", { name: "Bahasa Melayu" }));

		expect(document.cookie).toContain("lang=ms");
		expect(router.refresh).toHaveBeenCalledTimes(1);
	});

	it("tells the signed-in shell of each choice, and applies a language without it counting as one (enhancement 5.2)", async () => {
		const heard = vi.fn();
		const captured: { apply: ((language: UiKitLanguage) => void) | null } = { apply: null };
		function Listener(): null {
			const choices = useAppLanguageChoices();
			React.useEffect((): (() => void) | undefined => {
				captured.apply = choices?.apply ?? null;
				return choices?.onChosen(heard);
			}, [choices]);
			return null;
		}
		render(
			<AppLanguageProvider language="en">
				<Listener />
				<ShellLanguageToggle />
			</AppLanguageProvider>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Choose language" }));
		fireEvent.click(await screen.findByRole("menuitemradio", { name: "Bahasa Melayu" }));
		expect(heard).toHaveBeenCalledWith("ms");

		captured.apply?.("ta");
		expect(document.cookie).toContain("lang=ta");
		expect(heard).toHaveBeenCalledTimes(1);
	});
});

describe("hasLanguageCookie", () => {
	it("says whether this device chose a language", () => {
		expect(hasLanguageCookie("theme=dark; lang=ms")).toBe(true);
		expect(hasLanguageCookie("theme=dark; language=ms")).toBe(false);
		expect(hasLanguageCookie("")).toBe(false);
	});
});
