// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { UI_KIT_LABELS_EN } from "../lib/labels/en";
import type { UiKitLabels, UiKitLabelsOverride } from "../lib/labels/ui-kit-labels";
import { UiKitTestProviders } from "../testing/ui-kit-test-providers";
import { AuthLayout } from "./auth-layout";
import { UiKitLabelsProvider } from "./ui-kit-labels-provider";

afterEach((): void => {
	cleanup();
});

/** A per-usage override of one string — the rest must still come from the `authLayout` family. */
const LABELS = { toggleThemeAria: "Changer le thème" } satisfies UiKitLabelsOverride<"authLayout">;

/** A label set whose `authLayout` family differs from English — proves the provider supplies the copy. */
const GERMAN_LABELS: UiKitLabels = {
	...UI_KIT_LABELS_EN,
	authLayout: { mobileBack: "Zurück", toggleThemeAria: "Design wechseln", rightsReserved: "Alle Rechte vorbehalten." },
};
const FEATURES: readonly string[] = ["Fast"];

function renderLayout(ref?: React.Ref<HTMLDivElement>): ReturnType<typeof render> {
	return render(
		<AuthLayout ref={ref} logo={null} brandName="Acme" tagline="Rewards" features={FEATURES} title="Sign in" subtitle="Welcome back" labels={LABELS}>
			<form aria-label="login" />
		</AuthLayout>,
		{ wrapper: UiKitTestProviders },
	);
}

function UnlabelledLayout(): React.JSX.Element {
	return (
		<AuthLayout logo={null} brandName="Acme" tagline="Rewards" features={FEATURES} title="Sign in" subtitle="Welcome back" showBackButton>
			<form aria-label="login" />
		</AuthLayout>
	);
}

describe("AuthLayout", () => {
	it("uses the shared theme toggle, named from its labels", (): void => {
		renderLayout();
		const toggle = screen.getByRole("button", { name: LABELS.toggleThemeAria });
		expect(toggle.dataset.slot).toBe("shell-theme-toggle");
	});

	it("sizes its ambient glows from the spacing scale (no inline px styles) and respects reduced motion", (): void => {
		const { container } = renderLayout();
		for (const element of container.querySelectorAll<HTMLElement>("[style]")) {
			expect(element.style.width).toBe("");
			expect(element.style.height).toBe("");
		}
		expect(container.querySelector(".animate-pulse:not([class*='motion-safe'])")).toBeNull();
		expect(container.querySelector(".size-100")).not.toBeNull();
	});

	it("forwards its ref to the layout root", (): void => {
		const ref = React.createRef<HTMLDivElement>();
		renderLayout(ref);
		expect(ref.current?.dataset.slot).toBe("auth-layout");
	});

	it("lays a partial labels prop over the family: the other strings stay the family's", (): void => {
		renderLayout();
		expect(screen.getAllByText(UI_KIT_LABELS_EN.authLayout.rightsReserved, { exact: false }).length).toBeGreaterThan(0);
	});

	it("reads the authLayout family from the nearest UiKitLabelsProvider", (): void => {
		render(
			<UiKitLabelsProvider labels={GERMAN_LABELS}>
				<UnlabelledLayout />
			</UiKitLabelsProvider>,
		);
		expect(screen.getByRole("button", { name: GERMAN_LABELS.authLayout.toggleThemeAria })).toBeTruthy();
		expect(screen.getByRole("link", { name: GERMAN_LABELS.authLayout.mobileBack })).toBeTruthy();
		expect(screen.getAllByText(GERMAN_LABELS.authLayout.rightsReserved, { exact: false }).length).toBeGreaterThan(0);
	});

	it("throws without a UiKitLabelsProvider", (): void => {
		expect(() => render(<UnlabelledLayout />)).toThrow('"authLayout" labels');
	});
});
