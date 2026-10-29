// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
	Command,
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
	CommandShortcut,
	commandItemMatches,
	createCommandRegistry,
} from "../command";
import { UiKitTestProviders } from "../../testing/ui-kit-test-providers";

/** Base UI measures the command list and scrolls the highlighted item into view — jsdom implements neither. */
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

/** Case- and accent-blind "contains", the shape Base UI's filter has. */
function contains(text: string, query: string): boolean {
	return text.toLocaleLowerCase().includes(query.toLocaleLowerCase());
}

interface MenuProps {
	readonly onSelect?: (value: string) => void;
	readonly shouldFilter?: boolean;
	readonly query?: string;
	readonly onQueryChange?: (value: string) => void;
}

function Menu({ onSelect, shouldFilter, query, onQueryChange }: MenuProps): React.JSX.Element {
	return (
		<Command label="Commands" {...(shouldFilter === undefined ? {} : { shouldFilter })}>
			<CommandInput
				placeholder="Search"
				aria-label="Search commands"
				{...(query === undefined ? {} : { value: query })}
				{...(onQueryChange === undefined ? {} : { onValueChange: onQueryChange })}
			/>
			<CommandList>
				<CommandEmpty>Nothing found.</CommandEmpty>
				<CommandGroup heading="Suggestions">
					<CommandItem value="Calendar" {...(onSelect === undefined ? {} : { onSelect })}>
						Calendar
					</CommandItem>
					<CommandItem value="Search Emoji" keywords={["smiley"]} {...(onSelect === undefined ? {} : { onSelect })}>
						Search Emoji
					</CommandItem>
					<CommandItem value="Calculator" disabled {...(onSelect === undefined ? {} : { onSelect })}>
						Calculator
					</CommandItem>
				</CommandGroup>
				<CommandSeparator />
				<CommandGroup heading="Settings">
					<CommandItem value="Profile" {...(onSelect === undefined ? {} : { onSelect })}>
						Profile
						<CommandShortcut>⌘P</CommandShortcut>
					</CommandItem>
				</CommandGroup>
			</CommandList>
		</Command>
	);
}

function search(text: string): void {
	fireEvent.change(screen.getByRole("combobox", { name: "Search commands" }), { target: { value: text } });
}

describe("commandItemMatches", () => {
	it("matches everything on an empty or blank query", () => {
		expect(commandItemMatches(contains, "", "Calendar")).toBe(true);
		expect(commandItemMatches(contains, "   ", "Calendar")).toBe(true);
	});

	it("matches the value or any keyword, ignoring surrounding spaces", () => {
		expect(commandItemMatches(contains, " cal ", "Calendar")).toBe(true);
		expect(commandItemMatches(contains, "smiley", "Search Emoji", ["smiley"])).toBe(true);
		expect(commandItemMatches(contains, "billing", "Calendar", ["dates"])).toBe(false);
	});
});

describe("createCommandRegistry", () => {
	it("counts rendered items overall and per group, and forgets them", () => {
		const registry = createCommandRegistry();
		const listener = vi.fn<() => void>();
		const unsubscribe = registry.subscribe(listener);
		const forgetA = registry.show("a", "g1");
		registry.show("b", "g1");
		registry.show("c", null);

		expect(registry.countAll()).toBe(3);
		expect(registry.countIn("g1")).toBe(2);
		forgetA();
		expect(registry.countIn("g1")).toBe(1);
		expect(listener).toHaveBeenCalledTimes(4);
		unsubscribe();
		registry.show("d", null);
		expect(listener).toHaveBeenCalledTimes(4);
	});
});

describe("Command", () => {
	it("lists every item under its heading, with the list named by the command's label", () => {
		render(<Menu />, { wrapper: UiKitTestProviders });

		expect(screen.getByRole("listbox", { name: "Commands" })).toBeTruthy();
		expect(screen.getAllByRole("option").map((option: HTMLElement): string => option.textContent)).toEqual(["Calendar", "Search Emoji", "Calculator", "Profile⌘P"]);
		expect(screen.getByText("Suggestions")).toBeTruthy();
		expect(screen.queryByText("Nothing found.")).toBeNull();
	});

	it("filters by value and keywords as the user types, hiding a group with nothing left", () => {
		render(<Menu />, { wrapper: UiKitTestProviders });

		search("smiley");
		expect(screen.getAllByRole("option").map((option: HTMLElement): string => option.textContent)).toEqual(["Search Emoji"]);
		expect(screen.getByText("Settings").closest('[data-slot="command-group"]')?.hasAttribute("hidden")).toBe(true);
	});

	it("shows the empty state when nothing matches", () => {
		render(<Menu />, { wrapper: UiKitTestProviders });

		search("zzz");
		expect(screen.queryAllByRole("option")).toHaveLength(0);
		expect(screen.getByText("Nothing found.")).toBeTruthy();
	});

	it("runs an item with its value on click, and never a disabled one", () => {
		const onSelect = vi.fn<(value: string) => void>();
		render(<Menu onSelect={onSelect} />, { wrapper: UiKitTestProviders });

		fireEvent.click(screen.getByRole("option", { name: "Calendar" }));
		fireEvent.click(screen.getByRole("option", { name: "Calculator" }));

		expect(onSelect).toHaveBeenCalledTimes(1);
		expect(onSelect).toHaveBeenCalledWith("Calendar");
	});

	it("highlights the first item and runs the highlighted one on Enter, leaving the search as typed", () => {
		const onSelect = vi.fn<(value: string) => void>();
		render(<Menu onSelect={onSelect} />, { wrapper: UiKitTestProviders });

		search("pro");
		const input = screen.getByRole("combobox", { name: "Search commands" });
		expect(screen.getByRole("option", { name: "Profile⌘P" }).hasAttribute("data-highlighted")).toBe(true);
		fireEvent.keyDown(input, { key: "Enter" });

		expect(onSelect).toHaveBeenCalledWith("Profile");
		expect(input).toHaveProperty("value", "pro");
	});

	it("leaves the filtering to the caller when shouldFilter is off", () => {
		render(<Menu shouldFilter={false} />, { wrapper: UiKitTestProviders });

		search("zzz");
		expect(screen.getAllByRole("option")).toHaveLength(4);
	});

	it("follows a search the caller controls, and reports what is typed", () => {
		const onQueryChange = vi.fn<(value: string) => void>();
		const view = render(<Menu query="cal" onQueryChange={onQueryChange} />, { wrapper: UiKitTestProviders });

		expect(screen.getAllByRole("option").map((option: HTMLElement): string => option.textContent)).toEqual(["Calendar", "Calculator"]);
		search("prof");
		expect(onQueryChange).toHaveBeenCalledWith("prof");
		view.rerender(<Menu query="prof" onQueryChange={onQueryChange} />);
		expect(screen.getAllByRole("option").map((option: HTMLElement): string => option.textContent)).toEqual(["Profile⌘P"]);
	});

	it("refuses parts rendered outside a Command", () => {
		const quiet = vi.spyOn(console, "error").mockImplementation((): void => undefined);
		expect((): void => {
			render(<CommandEmpty>Nothing</CommandEmpty>);
		}).toThrow("<CommandEmpty> must be rendered inside <Command>.");
		quiet.mockRestore();
	});
});

describe("CommandDialog", () => {
	it("closes on Escape from the search", () => {
		const onOpenChange = vi.fn<(open: boolean) => void>();
		render(
			<CommandDialog open title="Command palette" description="Search for a command" onOpenChange={onOpenChange}>
				<Menu />
			</CommandDialog>,
			{ wrapper: UiKitTestProviders },
		);

		fireEvent.keyDown(screen.getByRole("combobox", { name: "Search commands" }), { key: "Escape" });

		expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());
	});
});
