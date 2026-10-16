// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { stubLoadedImages } from "../../testing/loaded-image-stub";
import { UiKitTestProviders } from "../../testing/ui-kit-test-providers";
import { AppShellSidebarAccount } from "../app-shell-sidebar-account";

const PICTURE = { url: "https://cdn.example.com/users/ada/avatar.webp", sources: [{ width: 128, url: "https://cdn.example.com/users/ada/thumbnail.webp" }] };

let restoreImages: () => void;

beforeEach((): void => {
	restoreImages = stubLoadedImages();
});

afterEach((): void => {
	cleanup();
	restoreImages();
});

describe("AppShellSidebarAccount", () => {
	it("shows the signed-in person's initials, name and email when they have no picture", () => {
		render(<AppShellSidebarAccount name="Ada Lovelace" email="ada@example.com" onLogout={vi.fn()} />, { wrapper: UiKitTestProviders });

		expect(screen.getByText("AL")).toBeTruthy();
		expect(screen.getByText("ada@example.com")).toBeTruthy();
		expect(document.querySelector('[data-slot="app-shell-sidebar-account"] img')).toBeNull();
	});

	it("shows their profile picture, its smallest sharp rendition for the 28 px row", () => {
		render(<AppShellSidebarAccount name="Ada Lovelace" email="ada@example.com" avatar={PICTURE} onLogout={vi.fn()} />, { wrapper: UiKitTestProviders });

		const picture = document.querySelector('[data-slot="app-shell-sidebar-account"] img');
		expect(picture?.getAttribute("src")).toBe(PICTURE.url);
		expect(picture?.getAttribute("srcset")).toBe("https://cdn.example.com/users/ada/thumbnail.webp 128w");
		expect(picture?.getAttribute("sizes")).toBe("28px");
	});
});
