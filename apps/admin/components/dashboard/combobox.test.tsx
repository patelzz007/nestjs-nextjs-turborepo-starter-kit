// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useCallback, useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	Combobox,
	ComboboxChip,
	ComboboxChips,
	ComboboxClearAll,
	ComboboxContent,
	ComboboxCreate,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
	comboboxChipLabelSchema,
	comboboxSizeSchema,
	type ComboboxRef,
} from "@workspace/ui/components/combobox";

/** Named render-prop for the create-new row (rule 16: no inline arrows in props). */
function createLabel(query: string): string {
	return `Create "${query}"`;
}

/** jsdom has no ResizeObserver; base-ui tolerates its absence, stub to be safe. */
class ResizeObserverStub {
	public observe(): void {
		return;
	}
	public unobserve(): void {
		return;
	}
	public disconnect(): void {
		return;
	}
}

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("Combobox", () => {
	it("renders the input with a placeholder (improvement 20 / rule 9)", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		render(
			<Combobox>
				<ComboboxInput placeholder="Pick a country…" />
			</Combobox>,
		);
		const input = screen.getByPlaceholderText("Pick a country…");
		expect(input).toBeTruthy();
		expect(input.getAttribute("data-slot")).toBe("input-group-control");
	});

	it("exposes the imperative ref API: focus() moves focus to the input (improvement 1)", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);

		function RefHarness(): React.JSX.Element {
			const ref = useRef<ComboboxRef | null>(null);
			const handleFocus = useCallback((): void => {
				ref.current?.focus();
			}, []);
			return (
				<div>
					<button type="button" onClick={handleFocus}>
						Focus combobox
					</button>
					<Combobox ref={ref}>
						<ComboboxInput placeholder="Target" />
					</Combobox>
				</div>
			);
		}

		render(<RefHarness />);
		fireEvent.click(screen.getByRole("button", { name: "Focus combobox" }));
		expect(document.activeElement).toBe(screen.getByPlaceholderText("Target"));
	});

	it("threads the size variant onto the input group and chips (improvement 2)", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		const { container } = render(
			<Combobox size="sm">
				<ComboboxInput placeholder="Compact" />
				<ComboboxChips>
					<ComboboxChip>A</ComboboxChip>
				</ComboboxChips>
			</Combobox>,
		);
		// The InputGroup carries the size override.
		expect(container.querySelector("[data-slot='input-group']")?.className).toContain("h-8");
		// The chips row follows the root size too.
		expect(container.querySelector("[data-slot='combobox-chips']")?.className).toContain("min-h-8");
	});

	it("renders the loading row inside the list when `loading` is set (improvement 7 / feature 1)", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		render(
			<Combobox loading defaultOpen>
				<ComboboxInput placeholder="Search" />
				<ComboboxContent>
					<ComboboxList loadingLabel="Fetching options…" />
				</ComboboxContent>
			</Combobox>,
		);
		const loading = document.querySelector("[data-slot='combobox-loading']");
		expect(loading).toBeTruthy();
		expect(loading?.getAttribute("aria-busy")).toBe("true");
		expect(screen.getByText("Fetching options…")).toBeTruthy();
	});

	it("renders items and selects one via the popup (features 16/17 native)", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		function SelectionHarness(): React.JSX.Element {
			return (
				<Combobox defaultValue="alpha" defaultOpen>
					<ComboboxInput placeholder="Pick" />
					<ComboboxContent>
						<ComboboxList>
							<ComboboxItem value="alpha">Alpha</ComboboxItem>
							<ComboboxItem value="beta">Beta</ComboboxItem>
						</ComboboxList>
					</ComboboxContent>
				</Combobox>
			);
		}
		render(<SelectionHarness />);
		// The open popup renders the items (portal → query the document).
		const items = Array.from(document.querySelectorAll("[data-slot='combobox-item']"));
		expect(items.length).toBe(2);
		// Clicking the other item selects it — the indicator follows the value.
		const otherItem = items[1];
		if (otherItem !== undefined) {
			fireEvent.click(otherItem);
		}
		expect(items[1]?.querySelector("svg")).toBeTruthy();
	});

	it("renders a two-line item when `description` is provided (feature 13)", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		render(
			<Combobox defaultOpen>
				<ComboboxInput placeholder="Pick" />
				<ComboboxContent>
					<ComboboxList>
						<ComboboxItem value="db" description="PostgreSQL 16">
							Database
						</ComboboxItem>
					</ComboboxList>
				</ComboboxContent>
			</Combobox>,
		);
		expect(screen.getByText("PostgreSQL 16")).toBeTruthy();
		expect(screen.getByText("Database")).toBeTruthy();
	});

	it("caps visible chips into a '+N more' chip (feature 9)", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		const { container } = render(
			<Combobox multiple maxChips={2}>
				<ComboboxChips>
					<ComboboxChip>A</ComboboxChip>
					<ComboboxChip>B</ComboboxChip>
					<ComboboxChip>C</ComboboxChip>
					<ComboboxChip>D</ComboboxChip>
				</ComboboxChips>
			</Combobox>,
		);
		const chips = Array.from(container.querySelectorAll("[data-slot='combobox-chip']"));
		expect(chips.length).toBe(2);
		const overflow = container.querySelector("[data-slot='combobox-chips-overflow']");
		expect(overflow?.textContent).toBe("+2");
		expect(overflow?.getAttribute("aria-label")).toBe("More selected options");
	});

	it("derives a per-chip remove aria-label from the label text (improvement 10)", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		const { container } = render(
			<Combobox multiple>
				<ComboboxChips>
					<ComboboxChip>React</ComboboxChip>
				</ComboboxChips>
			</Combobox>,
		);
		const remove = container.querySelector("[data-slot='combobox-chip-remove']");
		expect(remove?.getAttribute("aria-label")).toBe("Remove React");
	});

	it("supports an explicit removeLabel override (improvement 10)", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		const { container } = render(
			<Combobox multiple>
				<ComboboxChips>
					<ComboboxChip removeLabel="Deselect this tag">React</ComboboxChip>
				</ComboboxChips>
			</Combobox>,
		);
		const remove = container.querySelector("[data-slot='combobox-chip-remove']");
		expect(remove?.getAttribute("aria-label")).toBe("Deselect this tag");
	});

	it("labels the icon-only clear button (improvement 18)", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		// The clear button only renders when a value is selected, so the Root
		// starts with a defaultValue.
		const { container } = render(
			<Combobox defaultValue="alpha">
				<ComboboxInput showClear placeholder="Clearable" />
			</Combobox>,
		);
		const clear = container.querySelector("[data-slot='combobox-clear']");
		expect(clear).not.toBeNull();
		expect(clear?.getAttribute("aria-label")).toBe("Clear selection");
	});

	it("renders the create-new row and fires onCreate with the query (feature 2)", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		const onCreate = vi.fn();
		render(
			<Combobox>
				<ComboboxInput placeholder="Search" />
				<ComboboxCreate query="new-tag" createLabel={createLabel} onCreate={onCreate} />
			</Combobox>,
		);
		const createRow = screen.getByRole("button", { name: 'Create "new-tag"' });
		fireEvent.click(createRow);
		expect(onCreate).toHaveBeenCalledWith("new-tag");
	});

	it("renders a clear-all button with a label (feature 12)", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		const onClearAll = vi.fn();
		const { container } = render(<ComboboxClearAll onClick={onClearAll} />);
		const button = container.querySelector("[data-slot='combobox-clear-all']");
		expect(button?.getAttribute("aria-label")).toBe("Clear all");
		if (button !== null) {
			fireEvent.click(button);
		}
		expect(onClearAll).toHaveBeenCalledTimes(1);
	});

	it("mirrors disabled onto the input with aria-disabled (improvement 16)", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		const { container } = render(
			<Combobox>
				<ComboboxInput disabled placeholder="Locked" />
			</Combobox>,
		);
		const input = container.querySelector("[data-slot='input-group-control']");
		expect(input?.getAttribute("disabled")).not.toBeNull();
		expect(input?.getAttribute("aria-disabled")).toBe("true");
	});

	it("shows the empty message via the `text` prop (improvement 20)", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		render(
			<Combobox defaultOpen>
				<ComboboxInput placeholder="Search" />
				<ComboboxContent>
					<ComboboxList>
						<ComboboxEmpty text="Nothing matches your search" />
					</ComboboxList>
				</ComboboxContent>
			</Combobox>,
		);
		// The empty node carries the message (it's `hidden` until the content is
		// `data-empty`, so assert on the slot rather than a visible-text query).
		const emptyNode = document.querySelector("[data-slot='combobox-empty']");
		expect(emptyNode?.textContent).toContain("Nothing matches your search");
	});

	it("opens + focuses the input when the `shortcut` is pressed (feature 11)", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		render(
			<Combobox shortcut="⌘K">
				<ComboboxInput placeholder="Shortcut target" />
			</Combobox>,
		);
		fireEvent.keyDown(window, { key: "k", metaKey: true });
		expect(document.activeElement).toBe(screen.getByPlaceholderText("Shortcut target"));
	});

	it("does not open for a mismatched shortcut (feature 11)", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		render(
			<Combobox shortcut="⌘K">
				<ComboboxInput placeholder="Shortcut target" />
			</Combobox>,
		);
		fireEvent.keyDown(window, { key: "j", metaKey: true });
		expect(document.activeElement).not.toBe(screen.getByPlaceholderText("Shortcut target"));
	});

	it("vetoes maxSelected picks in UNCONTROLLED mode via details.cancel() (feature 6)", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		// Uncontrolled multi-select: base-ui owns the value internally, so the
		// guard must revert the store with `details.cancel()` — an early return
		// alone would let the pick land.
		const onMaxReached = vi.fn();
		render(
			<Combobox multiple defaultOpen maxSelected={1} onMaxSelectedReached={onMaxReached}>
				<ComboboxInput placeholder="Pick" />
				<ComboboxContent>
					<ComboboxList>
						<ComboboxItem value="a">A</ComboboxItem>
						<ComboboxItem value="b">B</ComboboxItem>
					</ComboboxList>
				</ComboboxContent>
			</Combobox>,
		);
		const items = Array.from(document.querySelectorAll("[data-slot='combobox-item']"));
		const first = items[0];
		if (first !== undefined) {
			fireEvent.click(first);
		}
		const second = items[1];
		if (second !== undefined) {
			fireEvent.click(second);
		}
		// The second pick must be vetoed: only ONE item shows its check indicator
		// (base-ui renders the indicator only for the selected item), and the
		// smart component was told why.
		expect(document.querySelectorAll("[data-slot='combobox-item'] [data-slot='combobox-item-indicator']").length).toBe(1);
		expect(onMaxReached).toHaveBeenCalledWith(1);
	});

	it("debounces onInputValueChange by debounceMs (feature 8)", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		vi.useFakeTimers();
		const onInput = vi.fn();
		render(
			<Combobox debounceMs={250} onInputValueChange={onInput}>
				<ComboboxInput placeholder="Debounced" />
			</Combobox>,
		);
		const input = screen.getByPlaceholderText("Debounced");
		fireEvent.change(input, { target: { value: "re" } });
		fireEvent.change(input, { target: { value: "rea" } });
		fireEvent.change(input, { target: { value: "react" } });
		// No call yet — the debounce window hasn't elapsed.
		expect(onInput).not.toHaveBeenCalled();
		act(() => {
			vi.advanceTimersByTime(300);
		});
		// Exactly one call, with the LAST value.
		expect(onInput).toHaveBeenCalledTimes(1);
		expect(onInput).toHaveBeenCalledWith("react", expect.any(Object));
		vi.useRealTimers();
	});

	it("renders the empty-state CTA and fires onAction (feature 10)", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		const onAction = vi.fn();
		render(
			<Combobox defaultOpen>
				<ComboboxInput placeholder="Search" />
				<ComboboxContent>
					<ComboboxList>
						<ComboboxEmpty text="Nothing matches" actionLabel='Create "new-tag"' onAction={onAction} />
					</ComboboxList>
				</ComboboxContent>
			</Combobox>,
		);
		const action = document.querySelector("[data-slot='combobox-empty-action']");
		expect(action?.textContent).toContain('Create "new-tag"');
		if (action !== null) {
			fireEvent.click(action);
		}
		expect(onAction).toHaveBeenCalledTimes(1);
	});

	it("persists and restores the draft query via sessionStorage (feature 19)", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		const { unmount } = render(
			<Combobox persistQueryKey="combobox-test-draft">
				<ComboboxInput placeholder="Persisted" />
			</Combobox>,
		);
		const input = screen.getByPlaceholderText("Persisted");
		fireEvent.change(input, { target: { value: "draft-query" } });
		expect(window.sessionStorage.getItem("combobox-test-draft")).toBe("draft-query");
		// Remount — the draft must be restored into the input (checked by value,
		// no type assertion — rule 4).
		unmount();
		render(
			<Combobox persistQueryKey="combobox-test-draft">
				<ComboboxInput placeholder="Persisted" />
			</Combobox>,
		);
		expect(screen.getByDisplayValue("draft-query")).toBeTruthy();
		window.sessionStorage.removeItem("combobox-test-draft");
	});

	it("announces the selection count via an sr-only live region (feature 20)", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		render(
			<Combobox multiple defaultValue={["a", "b"]}>
				<ComboboxInput placeholder="Pick" />
			</Combobox>,
		);
		const region = document.querySelector("[data-slot='combobox-live-region']");
		expect(region?.textContent).toBe("2 selected");
		expect(region?.getAttribute("aria-live")).toBe("polite");
	});

	it("remote search: itemToStringLabel keeps the label in the input and filter={null} prevents a false 'not found' on reopen", async () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);

		// Minimal remote-search harness mirroring the dashboard demo: the smart
		// component owns the options, the query and the selected value.
		const LANGUAGES: readonly { readonly value: string; readonly label: string }[] = [
			{ value: "ts", label: "TypeScript" },
			{ value: "js", label: "JavaScript" },
			{ value: "py", label: "Python" },
			{ value: "rb", label: "Ruby" },
			{ value: "rs", label: "Rust" },
		];

		function RemoteHarness(): React.JSX.Element {
			const [value, setValue] = useState<string | null>(null);
			const [isLoading, setIsLoading] = useState(false);
			const [options, setOptions] = useState<readonly { readonly value: string; readonly label: string }[]>(LANGUAGES.slice(0, 3));
			const [query, setQuery] = useState("");

			const handleRemoteSearch = useCallback((nextQuery: string): void => {
				setQuery(nextQuery);
				setIsLoading(true);
				window.setTimeout(() => {
					const needle = nextQuery.trim().toLowerCase();
					setOptions(needle === "" ? LANGUAGES.slice(0, 3) : LANGUAGES.filter((option) => option.label.toLowerCase().includes(needle)));
					setIsLoading(false);
				}, 30);
			}, []);

			// value -> label map (base-ui's `itemToStringLabel`): without it the
			// input fills with the raw value ("js") after a pick.
			const labelOf = useCallback((optionValue: string): string => LANGUAGES.find((option) => option.value === optionValue)?.label ?? optionValue, []);

			return (
				<Combobox defaultOpen value={value} onValueChange={setValue} itemToStringLabel={labelOf} filter={null} onInputValueChange={handleRemoteSearch} loading={isLoading}>
					<ComboboxInput placeholder="Search languages…" />
					<ComboboxContent>
						<ComboboxList>
							{options.map((option) => (
								<ComboboxItem key={option.value} value={option.value}>
									{option.label}
								</ComboboxItem>
							))}
							{!isLoading && query.trim() !== "" && options.length === 0 ? <ComboboxEmpty text={`Nothing matches "${query}"`} /> : null}
						</ComboboxList>
					</ComboboxContent>
				</Combobox>
			);
		}

		render(<RemoteHarness />);
		const input = screen.getByPlaceholderText("Search languages…");

		// 1) Type a search and let the (mocked) remote layer resolve it.
		act(() => {
			fireEvent.change(input, { target: { value: "javascript" } });
		});
		await waitFor(
			() => {
				expect(screen.getByText("JavaScript")).toBeTruthy();
			},
			{ timeout: 2000 },
		);

		// 2) Pick it — the input must show the LABEL ("JavaScript"), not the raw
		//    value ("js"), because `itemToStringLabel` is wired up (asserted via
		//    the input's display value — no type cast, rule 4).
		act(() => {
			fireEvent.click(screen.getByText("JavaScript"));
		});
		expect(screen.getByDisplayValue("JavaScript")).toBeTruthy();

		// 3) Reopen-sync: the input now holds the label; re-running the remote
		//    search on it must find the item again and never show a bogus
		//    "Nothing matches "js"" empty state.
		act(() => {
			fireEvent.change(input, { target: { value: "JavaScript" } });
		});
		await waitFor(
			() => {
				expect(screen.queryByText(/Nothing matches/)).toBeNull();
			},
			{ timeout: 2000 },
		);
		expect(screen.getByText("JavaScript")).toBeTruthy();
	});

	it("reopening a remote combobox resets to the default options via onOpenChange", async () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);

		const LANGUAGES: readonly { readonly value: string; readonly label: string }[] = [
			{ value: "ts", label: "TypeScript" },
			{ value: "js", label: "JavaScript" },
			{ value: "py", label: "Python" },
			{ value: "rb", label: "Ruby" },
		];

		// Controlled-open harness: the smart component drives `open` and resets
		// the query on every open (the "reset to default" pattern).
		function ResetHarness(): React.JSX.Element {
			const [open, setOpen] = useState(false);
			const [isLoading, setIsLoading] = useState(false);
			const [options, setOptions] = useState<readonly { readonly value: string; readonly label: string }[]>(LANGUAGES.slice(0, 3));
			const [query, setQuery] = useState("");

			const handleRemoteSearch = useCallback((nextQuery: string): void => {
				setQuery(nextQuery);
				setIsLoading(true);
				window.setTimeout(() => {
					const needle = nextQuery.trim().toLowerCase();
					setOptions(needle === "" ? LANGUAGES.slice(0, 3) : LANGUAGES.filter((option) => option.label.toLowerCase().includes(needle)));
					setIsLoading(false);
				}, 30);
			}, []);

			const handleOpenChange = useCallback(
				(nextOpen: boolean): void => {
					setOpen(nextOpen);
					if (nextOpen) {
						handleRemoteSearch("");
					}
				},
				[handleRemoteSearch],
			);

			const toggleOpen = useCallback((): void => {
				setOpen((current) => !current);
			}, []);

			return (
				<div>
					{/* While the popup is open, base-ui marks background content aria-hidden
					    (modal focus-trap), so the test closes the popup with Escape before
					    clicking the toggle again. */}
					<button type="button" onClick={toggleOpen}>
						Toggle
					</button>
					<Combobox open={open} onOpenChange={handleOpenChange} filter={null} onInputValueChange={handleRemoteSearch} loading={isLoading}>
						<ComboboxInput placeholder="Search…" />
						<ComboboxContent>
							<ComboboxList>
								{options.map((option) => (
									<ComboboxItem key={option.value} value={option.value}>
										{option.label}
									</ComboboxItem>
								))}
								{!isLoading && query.trim() !== "" && options.length === 0 ? <ComboboxEmpty text={`Nothing matches "${query}"`} /> : null}
							</ComboboxList>
						</ComboboxContent>
					</Combobox>
				</div>
			);
		}

		render(<ResetHarness />);
		const input = screen.getByPlaceholderText("Search…");

		// 1) Open → the default option set loads (TypeScript, JavaScript, Python).
		fireEvent.click(screen.getByRole("button", { name: "Toggle" }));
		await waitFor(
			() => {
				expect(screen.getByText("Python")).toBeTruthy();
			},
			{ timeout: 2000 },
		);

		// 2) Search narrows the list to JavaScript only.
		act(() => {
			fireEvent.change(input, { target: { value: "javascript" } });
		});
		await waitFor(
			() => {
				expect(screen.queryByText("Python")).toBeNull();
				expect(screen.getByText("JavaScript")).toBeTruthy();
			},
			{ timeout: 2000 },
		);

		// 3) Close with Escape (the toggle button is aria-hidden while the popup
		//    is open), then reopen → the reset brings the default options back
		//    (Python is visible again) instead of the stale "javascript" results.
		act(() => {
			fireEvent.keyDown(input, { key: "Escape" });
		});
		await waitFor(
			() => {
				expect(screen.queryByText("Python")).toBeNull();
			},
			{ timeout: 2000 },
		);
		fireEvent.click(screen.getByRole("button", { name: "Toggle" }));
		await waitFor(
			() => {
				expect(screen.getByText("Python")).toBeTruthy();
				expect(screen.getByText("TypeScript")).toBeTruthy();
			},
			{ timeout: 2000 },
		);
	});

	it("exports zod schemas for size and chip labels (improvement 9 / rule 13)", () => {
		expect(comboboxSizeSchema.options).toEqual(["sm", "default", "lg"]);
		expect(comboboxSizeSchema.parse("lg")).toBe("lg");
		expect(comboboxSizeSchema.safeParse("xl").success).toBe(false);
		expect(comboboxChipLabelSchema.safeParse("React").success).toBe(true);
		expect(comboboxChipLabelSchema.safeParse(42).success).toBe(false);
	});
});
