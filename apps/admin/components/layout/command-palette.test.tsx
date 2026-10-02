// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import type { AppCommandPaletteQuickAction } from "@workspace/ui/components/navigation/app-command-palette";
import type { PaletteSearchableItem } from "@workspace/ui/lib/palette/types";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthorizedNavigationProvider } from "@/components/layout/authorized-navigation";
import { CommandPalette } from "@/components/layout/command-palette";
import { ROUTES } from "@/lib/routes";

interface StubPaletteProps {
	readonly searchableItems: readonly PaletteSearchableItem[];
	readonly quickActions: readonly AppCommandPaletteQuickAction[];
}

vi.mock("@workspace/ui/components/navigation/app-command-palette", () => ({
	AppCommandPalette: ({ searchableItems, quickActions }: StubPaletteProps): React.JSX.Element => (
		<>
			<ul aria-label="pages">
				{searchableItems.map((item) => (
					<li key={item.id}>{item.title}</li>
				))}
			</ul>
			<ul aria-label="actions">
				{quickActions.map((action) => (
					<li key={action.id}>{action.title}</li>
				))}
			</ul>
		</>
	),
}));

vi.mock("next/navigation", () => ({
	useRouter: (): { push: () => void } => ({ push: vi.fn() }),
}));

vi.mock("next-themes", () => ({
	useTheme: (): { setTheme: () => void; resolvedTheme: string } => ({ setTheme: vi.fn(), resolvedTheme: "light" }),
}));

const AUTHORIZED_ITEMS: readonly PaletteSearchableItem[] = [
	{ id: "main-billing", title: "Billing", url: "/settings/billing", section: "Main", breadcrumb: ["Settings", "Billing"] },
];

function allowAll(): boolean {
	return true;
}

/** Denies the settings pages (as the guard would for a session without them). */
function denySettings(href: string): boolean {
	return href !== ROUTES.settings.billing && href !== ROUTES.settings.index;
}

afterEach(() => {
	cleanup();
});

function titlesIn(listName: string): readonly string[] {
	return within(screen.getByRole("list", { name: listName }))
		.queryAllByRole("listitem")
		.map((item) => item.textContent);
}

function actionTitles(): readonly string[] {
	return titlesIn("actions");
}

describe("CommandPalette", () => {
	it("searches only the authorized items provided by the layout", () => {
		render(
			<AuthorizedNavigationProvider searchableItems={AUTHORIZED_ITEMS} canAccessRoute={allowAll}>
				<CommandPalette open setOpen={vi.fn()} />
			</AuthorizedNavigationProvider>,
		);

		expect(titlesIn("pages")).toEqual(["Billing"]);
	});

	it("offers every navigation quick action when each target page is allowed", () => {
		render(
			<AuthorizedNavigationProvider searchableItems={[]} canAccessRoute={allowAll}>
				<CommandPalette open setOpen={vi.fn()} />
			</AuthorizedNavigationProvider>,
		);

		expect(actionTitles()).toEqual(["Toggle Theme", "Open Settings", "Open Account", "Go to Dashboard", "Open Billing"]);
	});

	it("hides a quick action whose target page the route guard would deny", () => {
		render(
			<AuthorizedNavigationProvider searchableItems={[]} canAccessRoute={denySettings}>
				<CommandPalette open setOpen={vi.fn()} />
			</AuthorizedNavigationProvider>,
		);

		expect(actionTitles()).toEqual(["Toggle Theme", "Open Account", "Go to Dashboard"]);
	});

	it("shows no pages and only in-place actions outside the provider (fail closed)", () => {
		render(<CommandPalette open setOpen={vi.fn()} />);

		expect(titlesIn("pages")).toEqual([]);
		expect(actionTitles()).toEqual(["Toggle Theme"]);
	});
});
