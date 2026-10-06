// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { UI_KIT_LABELS_EN } from "../lib/labels/en";
import type { UiKitLabels, UiKitLabelsOverride } from "../lib/labels/ui-kit-labels";
import type { PaletteSearchableItem } from "../lib/palette/types";
import { UiKitTestProviders } from "../testing/ui-kit-test-providers";
import { AppCommandPalette, type AppCommandPaletteProps } from "./app-command-palette";
import { UiKitLabelsProvider } from "./ui-kit-labels-provider";

/** cmdk measures its list and scrolls the active item into view — jsdom implements neither. */
class NoopResizeObserver {
	public observe(): void {
		return undefined;
	}
	public unobserve(): void {
		return undefined;
	}
	public disconnect(): void {
		return undefined;
	}
}

beforeAll((): void => {
	vi.stubGlobal("ResizeObserver", NoopResizeObserver);
	Element.prototype.scrollIntoView = (): void => undefined;
});

afterEach((): void => {
	cleanup();
});

const ITEMS: readonly PaletteSearchableItem[] = [{ id: "rewards", title: "Rewards", url: "/rewards", section: "Catalog", breadcrumb: ["Catalog", "Rewards"] }];

const NO_RECENTS: AppCommandPaletteProps["recentSearches"] = [];
const NO_ACTIONS: AppCommandPaletteProps["quickActions"] = [];
const NO_PINS: readonly string[] = [];

function renderIcon(): React.ReactNode {
	return null;
}

type PaletteHarnessProps = Partial<AppCommandPaletteProps> & { readonly ref?: React.Ref<HTMLDivElement> };

function PaletteHarness(overrides: PaletteHarnessProps): React.JSX.Element {
	return (
		<AppCommandPalette
			open
			title="Palette"
			description="Search"
			searchableItems={ITEMS}
			quickActions={NO_ACTIONS}
			recentSearches={NO_RECENTS}
			pinnedUrls={NO_PINS}
			onAddRecent={vi.fn()}
			onTogglePinned={vi.fn()}
			onNavigate={vi.fn()}
			renderIcon={renderIcon}
			{...overrides}
		/>
	);
}

function renderPalette(overrides: PaletteHarnessProps = {}): ReturnType<typeof render> {
	return render(<PaletteHarness {...overrides} />, { wrapper: UiKitTestProviders });
}

/** A label set whose `appCommandPalette` family differs from English — proves the provider supplies the copy. */
const GERMAN_LABELS: UiKitLabels = {
	...UI_KIT_LABELS_EN,
	appCommandPalette: { ...UI_KIT_LABELS_EN.appCommandPalette, placeholder: "Seiten, Befehle, Einstellungen suchen…", footerNavigate: "navigieren" },
};

describe("AppCommandPalette", () => {
	it("renders its copy from the appCommandPalette family", (): void => {
		renderPalette();
		expect(screen.getByPlaceholderText(UI_KIT_LABELS_EN.appCommandPalette.placeholder)).toBeTruthy();
		expect(screen.getByText(UI_KIT_LABELS_EN.appCommandPalette.footerNavigate)).toBeTruthy();
	});

	it("lays a partial labels prop over the family for this usage only", (): void => {
		const labels: UiKitLabelsOverride<"appCommandPalette"> = {
			placeholder: "Rechercher…",
			pagesSectionTitle: "Pages du site",
			footerNavigate: "naviguer",
		};
		renderPalette({ labels });
		expect(screen.getByPlaceholderText("Rechercher…")).toBeTruthy();
		expect(screen.getByText("Pages du site")).toBeTruthy();
		expect(screen.getByText("naviguer")).toBeTruthy();
		// Strings the override leaves out still come from the family.
		expect(screen.getByText(UI_KIT_LABELS_EN.appCommandPalette.footerOpen)).toBeTruthy();
	});

	it("lets the placeholder prop win over the family's placeholder", (): void => {
		renderPalette({ placeholder: "Find anything…" });
		expect(screen.getByPlaceholderText("Find anything…")).toBeTruthy();
	});

	it("is controlled by searchText: typing reports through onSearchTextChange and the parent's value wins", (): void => {
		const onSearchTextChange = vi.fn();
		renderPalette({ searchText: "zzz-no-match", onSearchTextChange });

		const input = screen.getByPlaceholderText(UI_KIT_LABELS_EN.appCommandPalette.placeholder);
		expect(input).toHaveProperty("value", "zzz-no-match");
		expect(screen.getByText(UI_KIT_LABELS_EN.appCommandPalette.noResultsTitle)).toBeTruthy();

		fireEvent.change(input, { target: { value: "rew" } });
		expect(onSearchTextChange).toHaveBeenCalledWith("rew");
		expect(input).toHaveProperty("value", "zzz-no-match");
	});

	it("keeps its own search text when uncontrolled", (): void => {
		renderPalette();
		const input = screen.getByPlaceholderText(UI_KIT_LABELS_EN.appCommandPalette.placeholder);
		fireEvent.change(input, { target: { value: "zzz-no-match" } });
		expect(input).toHaveProperty("value", "zzz-no-match");
	});

	it("reports closing through both onOpenChange and the legacy setOpen", (): void => {
		const onOpenChange = vi.fn();
		const setOpen = vi.fn();
		const onNavigate = vi.fn();
		renderPalette({ onOpenChange, setOpen, onNavigate });

		fireEvent.click(screen.getByText("Rewards"));

		expect(onNavigate).toHaveBeenCalledWith("/rewards");
		expect(onOpenChange).toHaveBeenCalledWith(false);
		expect(setOpen).toHaveBeenCalledWith(false);
	});

	it("forwards its ref to the dialog popup", (): void => {
		const ref = React.createRef<HTMLDivElement>();
		renderPalette({ ref });
		expect(ref.current).toBeInstanceOf(HTMLElement);
	});

	it("reads the family from the nearest UiKitLabelsProvider", (): void => {
		render(
			<UiKitLabelsProvider labels={GERMAN_LABELS}>
				<PaletteHarness />
			</UiKitLabelsProvider>,
		);
		expect(screen.getByPlaceholderText(GERMAN_LABELS.appCommandPalette.placeholder)).toBeTruthy();
		expect(screen.getByText(GERMAN_LABELS.appCommandPalette.footerNavigate)).toBeTruthy();
	});

	it("throws without a UiKitLabelsProvider", (): void => {
		expect(() => render(<PaletteHarness />)).toThrow('"appCommandPalette" labels');
	});
});
