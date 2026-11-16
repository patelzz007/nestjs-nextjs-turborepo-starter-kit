// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import * as CommandPrimitive from "@workspace/ui/components/command-primitive";

beforeAll((): void => {
	// The list scrolls the highlighted option into view; jsdom has no layout.
	Element.prototype.scrollIntoView = (): void => undefined;
});

// Unmount after every test, whether or not the runner's setup does it for us.
afterEach((): void => {
	cleanup();
});

interface HarnessProps {
	readonly onSelect?: (value: string) => void;
	readonly loop?: boolean;
	readonly shouldFilter?: boolean;
}

function Harness({ onSelect, loop = false, shouldFilter = true }: HarnessProps): React.JSX.Element {
	return (
		<CommandPrimitive.Root label="Pages" loop={loop} shouldFilter={shouldFilter}>
			<CommandPrimitive.Input placeholder="Search" />
			<CommandPrimitive.List>
				<CommandPrimitive.Empty>No results</CommandPrimitive.Empty>
				<CommandPrimitive.Group heading="Overview">
					<CommandPrimitive.Item onSelect={onSelect}>Dashboard</CommandPrimitive.Item>
					<CommandPrimitive.Item value="analytics" keywords={["charts"]} onSelect={onSelect}>
						Analytics
					</CommandPrimitive.Item>
				</CommandPrimitive.Group>
				<CommandPrimitive.Separator />
				<CommandPrimitive.Group heading="Admin">
					<CommandPrimitive.Item value="users" onSelect={onSelect}>
						Users
					</CommandPrimitive.Item>
					<CommandPrimitive.Item value="roles" disabled onSelect={onSelect}>
						Roles
					</CommandPrimitive.Item>
				</CommandPrimitive.Group>
			</CommandPrimitive.List>
		</CommandPrimitive.Root>
	);
}

function input(): HTMLElement {
	return screen.getByRole("combobox", { name: "Pages" });
}

function selectedOption(): HTMLElement | undefined {
	return screen.queryAllByRole("option").find((option: HTMLElement): boolean => option.getAttribute("aria-selected") === "true");
}

describe("CommandPrimitive", () => {
	it("names the input by its own aria-label when it has one, instead of the list's label", () => {
		render(
			<CommandPrimitive.Root label="Search results">
				<CommandPrimitive.Input aria-label="Search the docs" />
				<CommandPrimitive.List>
					<CommandPrimitive.Item value="guides">Guides</CommandPrimitive.Item>
				</CommandPrimitive.List>
			</CommandPrimitive.Root>,
		);
		expect(screen.getByRole("combobox", { name: "Search the docs" })).toBeDefined();
		expect(screen.getByRole("listbox", { name: "Search results" })).toBeDefined();
	});

	it("is a labelled combobox that controls a listbox and highlights the first option", () => {
		render(<Harness />);
		const box = input();
		const list = screen.getByRole("listbox", { name: "Pages" });
		expect(box.getAttribute("aria-controls")).toBe(list.id);
		expect(selectedOption()?.textContent).toBe("Dashboard");
		expect(box.getAttribute("aria-activedescendant")).toBe(selectedOption()?.id);
		expect(screen.getByRole("group", { name: "Overview" })).toBeDefined();
	});

	it("filters by value, text and keywords, hiding empty groups and the separator", () => {
		const { container } = render(<Harness />);
		fireEvent.change(input(), { target: { value: "chart" } });
		expect(screen.getAllByRole("option").map((option: HTMLElement): string => option.textContent)).toEqual(["Analytics"]);
		expect(selectedOption()?.textContent).toBe("Analytics");
		expect(container.querySelector("[data-command-separator]")).toBeNull();
		const adminGroup = container.querySelectorAll("[data-command-group]").item(1);
		expect(adminGroup.hasAttribute("hidden")).toBe(true);
	});

	it("shows the empty state when nothing matches", () => {
		render(<Harness />);
		expect(screen.queryByText("No results")).toBeNull();
		fireEvent.change(input(), { target: { value: "zebra" } });
		expect(screen.getByText("No results")).toBeDefined();
		expect(input().getAttribute("aria-activedescendant")).toBeNull();
	});

	it("leaves filtering to the caller when shouldFilter is false", () => {
		render(<Harness shouldFilter={false} />);
		fireEvent.change(input(), { target: { value: "zebra" } });
		expect(screen.getAllByRole("option")).toHaveLength(4);
	});

	it("moves with the arrow keys, Home and End, skipping disabled options", () => {
		render(<Harness />);
		const box = input();
		fireEvent.keyDown(box, { key: "ArrowDown" });
		expect(selectedOption()?.textContent).toBe("Analytics");
		fireEvent.keyDown(box, { key: "End" });
		expect(selectedOption()?.textContent).toBe("Users");
		fireEvent.keyDown(box, { key: "ArrowDown" });
		expect(selectedOption()?.textContent).toBe("Users");
		fireEvent.keyDown(box, { key: "Home" });
		expect(selectedOption()?.textContent).toBe("Dashboard");
		fireEvent.keyDown(box, { key: "n", ctrlKey: true });
		expect(selectedOption()?.textContent).toBe("Analytics");
		fireEvent.keyDown(box, { key: "ArrowUp" });
		expect(selectedOption()?.textContent).toBe("Dashboard");
	});

	it("wraps around with loop", () => {
		render(<Harness loop />);
		fireEvent.keyDown(input(), { key: "ArrowUp" });
		expect(selectedOption()?.textContent).toBe("Users");
	});

	it("chooses with Enter or a click, never a disabled option", () => {
		const onSelect = vi.fn<(value: string) => void>();
		render(<Harness onSelect={onSelect} />);
		fireEvent.keyDown(input(), { key: "Enter" });
		expect(onSelect).toHaveBeenLastCalledWith("Dashboard");
		fireEvent.click(screen.getByRole("option", { name: "Users" }));
		expect(onSelect).toHaveBeenLastCalledWith("users");
		fireEvent.click(screen.getByRole("option", { name: "Roles" }));
		expect(onSelect).toHaveBeenCalledTimes(2);
	});

	it("highlights on pointer move and keeps focus in the search box on press", () => {
		render(<Harness />);
		const users = screen.getByRole("option", { name: "Users" });
		fireEvent.pointerMove(users);
		expect(selectedOption()).toBe(users);
		expect(fireEvent.mouseDown(users)).toBe(false);
	});

	it("reports the highlight through a controlled value", () => {
		function Controlled(): React.JSX.Element {
			const [value, setValue] = React.useState("users");
			return (
				<>
					<output>{value}</output>
					<CommandPrimitive.Root label="Pages" value={value} onValueChange={setValue}>
						<CommandPrimitive.Input />
						<CommandPrimitive.List>
							<CommandPrimitive.Item value="users">Users</CommandPrimitive.Item>
							<CommandPrimitive.Item value="roles">Roles</CommandPrimitive.Item>
						</CommandPrimitive.List>
					</CommandPrimitive.Root>
				</>
			);
		}
		render(<Controlled />);
		expect(selectedOption()?.textContent).toBe("Users");
		fireEvent.keyDown(input(), { key: "ArrowDown" });
		expect(screen.getByRole("status").textContent).toBe("roles");
	});

	it("throws a clear error outside a root", () => {
		vi.spyOn(console, "error").mockImplementation((): void => undefined);
		expect(() => render(<CommandPrimitive.Input />)).toThrow(/inside <CommandPrimitive.Root>/u);
	});
});
