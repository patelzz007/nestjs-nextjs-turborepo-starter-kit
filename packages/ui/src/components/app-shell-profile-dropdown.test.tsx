// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UI_KIT_LABELS_EN } from "../lib/labels/en";
import type { UiKitLabels } from "../lib/labels/ui-kit-labels";
import { UiKitTestProviders } from "../testing/ui-kit-test-providers";
import { AppShellProfileDropdown } from "./app-shell-profile-dropdown";
import { UiKitLabelsProvider } from "./ui-kit-labels-provider";

afterEach((): void => {
	cleanup();
});

/** A label set whose `appShellProfileDropdown` family differs from English — proves the provider supplies the copy. */
const GERMAN_LABELS: UiKitLabels = { ...UI_KIT_LABELS_EN, appShellProfileDropdown: { openMenuAriaLabel: "Profilmenü öffnen", logout: "Abmelden" } };

const LOGOUT_OVERRIDE = { logout: "Se déconnecter" };

describe("AppShellProfileDropdown", () => {
	it("names its trigger from the appShellProfileDropdown family", (): void => {
		render(<AppShellProfileDropdown name="Ada Lovelace" onLogout={vi.fn()} />, { wrapper: UiKitTestProviders });
		expect(screen.getByRole("button", { name: UI_KIT_LABELS_EN.appShellProfileDropdown.openMenuAriaLabel })).toBeTruthy();
	});

	it("is controlled by open: renders the menu with translated copy and reports logout", (): void => {
		const onLogout = vi.fn();
		render(
			<AppShellProfileDropdown
				open
				onOpenChange={vi.fn()}
				name="Ada Lovelace"
				email="ada@example.com"
				onLogout={onLogout}
				labels={{ openMenuAriaLabel: "Profil", logout: "Déconnexion" }}
			/>,
			{ wrapper: UiKitTestProviders },
		);

		expect(screen.getByRole("button", { name: "Profil" })).toBeTruthy();
		expect(screen.getByText("ada@example.com")).toBeTruthy();
		fireEvent.click(screen.getByText("Déconnexion"));
		expect(onLogout).toHaveBeenCalledTimes(1);
	});

	it("marks the presence dot with the success token, not a raw palette colour", (): void => {
		render(<AppShellProfileDropdown open name="Ada Lovelace" onLogout={vi.fn()} />, { wrapper: UiKitTestProviders });
		const dot = document.querySelector(".bg-success");
		expect(dot).not.toBeNull();
		expect(document.querySelector("[class*='emerald']")).toBeNull();
	});

	it("forwards its ref to the wrapper", (): void => {
		const ref = React.createRef<HTMLDivElement>();
		render(<AppShellProfileDropdown ref={ref} name="Ada" onLogout={vi.fn()} />, { wrapper: UiKitTestProviders });
		expect(ref.current?.dataset.slot).toBe("app-shell-profile-dropdown");
	});

	it("reads the family from the nearest UiKitLabelsProvider", (): void => {
		render(
			<UiKitLabelsProvider labels={GERMAN_LABELS}>
				<AppShellProfileDropdown open onOpenChange={vi.fn()} name="Ada Lovelace" onLogout={vi.fn()} />
			</UiKitLabelsProvider>,
		);
		expect(screen.getByRole("button", { name: GERMAN_LABELS.appShellProfileDropdown.openMenuAriaLabel })).toBeTruthy();
		expect(screen.getByText(GERMAN_LABELS.appShellProfileDropdown.logout)).toBeTruthy();
	});

	it("lays a partial labels prop over the family for this usage only", (): void => {
		render(<AppShellProfileDropdown open onOpenChange={vi.fn()} name="Ada Lovelace" onLogout={vi.fn()} labels={LOGOUT_OVERRIDE} />, {
			wrapper: UiKitTestProviders,
		});
		expect(screen.getByText(LOGOUT_OVERRIDE.logout)).toBeTruthy();
		expect(screen.getByRole("button", { name: UI_KIT_LABELS_EN.appShellProfileDropdown.openMenuAriaLabel })).toBeTruthy();
	});

	it("throws without a UiKitLabelsProvider", (): void => {
		expect(() => render(<AppShellProfileDropdown name="Ada" onLogout={vi.fn()} />)).toThrow('"appShellProfileDropdown" labels');
	});
});
