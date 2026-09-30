// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { PaletteSearchableItem } from "@workspace/ui/lib/palette/types";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthorizedNavigationProvider } from "@/components/layout/authorized-navigation";
import { CommandPalette } from "@/components/layout/command-palette";

interface StubPaletteProps {
	readonly searchableItems: readonly PaletteSearchableItem[];
}

vi.mock("@workspace/ui/components/navigation/app-command-palette", () => ({
	AppCommandPalette: ({ searchableItems }: StubPaletteProps): React.JSX.Element => (
		<ul>
			{searchableItems.map((item) => (
				<li key={item.id}>{item.title}</li>
			))}
		</ul>
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

afterEach(() => {
	cleanup();
});

describe("CommandPalette", () => {
	it("searches only the authorized items provided by the layout", () => {
		render(
			<AuthorizedNavigationProvider searchableItems={AUTHORIZED_ITEMS}>
				<CommandPalette open setOpen={vi.fn()} />
			</AuthorizedNavigationProvider>,
		);

		expect(screen.getByText("Billing")).toBeDefined();
		expect(screen.queryByText("Products")).toBeNull();
	});

	it("shows no pages outside the provider (fail closed)", () => {
		render(<CommandPalette open setOpen={vi.fn()} />);

		expect(screen.queryAllByRole("listitem")).toHaveLength(0);
	});
});
