// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useCallback, useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	Select,
	SelectA11yContract,
	SelectChip,
	SelectChips,
	SelectClear,
	SelectClearAll,
	SelectContent,
	SelectEmpty,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
	selectA11yProps,
	type SelectRef,
} from "@workspace/ui/components/select";

/** Value→label map used across the value/label and RHF-clear tests (rule 16: stable function). */
function labelOf(value: string): string {
	return value === "js" ? "JavaScript" : value === "ts" ? "TypeScript" : value === "py" ? "Python" : value;
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

/** Minimal single-select harness: controlled value + one option (rule 9/10 — data at the smart layer). */
function SingleSelectHarness({ onValueChange }: { readonly onValueChange?: (value: string | null) => void }): React.JSX.Element {
	const [value, setValue] = useState<string | null>(null);
	const handleChange = useCallback(
		(next: string | null): void => {
			setValue(next);
			onValueChange?.(next);
		},
		[onValueChange],
	);
	return (
		<Select value={value} onValueChange={handleChange} ariaLabel="Pick a language">
			<SelectTrigger>
				<SelectValue placeholder="Choose…" />
			</SelectTrigger>
			<SelectContent>
				<SelectItem value="ts">TypeScript</SelectItem>
				<SelectItem value="js">JavaScript</SelectItem>
			</SelectContent>
		</Select>
	);
}

describe("Select", () => {
	it("renders the trigger with the placeholder (improvement 20 / rule 9)", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		render(<SingleSelectHarness />);
		expect(screen.getByRole("combobox", { name: "Pick a language" })).toBeTruthy();
		expect(screen.getByText("Choose…")).toBeTruthy();
	});

	it("exposes the imperative ref API: focus() moves focus to the trigger (improvement 1)", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);

		function RefHarness(): React.JSX.Element {
			const ref = useRef<SelectRef | null>(null);
			const handleFocus = useCallback((): void => {
				ref.current?.focus();
			}, []);
			return (
				<div>
					<button type="button" onClick={handleFocus}>
						Focus select
					</button>
					<Select ref={ref} ariaLabel="Target">
						<SelectTrigger>
							<SelectValue placeholder="Pick…" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="a">Option A</SelectItem>
						</SelectContent>
					</Select>
				</div>
			);
		}

		render(<RefHarness />);
		fireEvent.click(screen.getByRole("button", { name: "Focus select" }));
		expect(document.activeElement).toBe(screen.getByRole("combobox", { name: "Target" }));
	});

	it("threads the size variant onto the trigger via data-size (improvement 2)", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		render(
			<Select size="sm" ariaLabel="Compact">
				<SelectTrigger>
					<SelectValue placeholder="Pick…" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="a">Option A</SelectItem>
				</SelectContent>
			</Select>,
		);
		const trigger = screen.getByRole("combobox", { name: "Compact" });
		expect(trigger.getAttribute("data-size")).toBe("sm");
	});

	it("shows a loading row with the provided label when loading (feature 1)", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		render(
			<Select loading defaultOpen ariaLabel="Loading select">
				<SelectTrigger>
					<SelectValue placeholder="Pick…" />
				</SelectTrigger>
				<SelectContent loadingLabel="Fetching teams…">
					<SelectItem value="a">Option A</SelectItem>
				</SelectContent>
			</Select>,
		);
		expect(screen.getByRole("status")).toBeTruthy();
		expect(screen.getByText("Fetching teams…")).toBeTruthy();
	});

	it("renders the empty row with an optional CTA (feature 2)", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		const onAction = vi.fn();
		render(
			<Select defaultOpen ariaLabel="Empty select">
				<SelectTrigger>
					<SelectValue placeholder="Pick…" />
				</SelectTrigger>
				<SelectContent>
					<SelectEmpty text="No roles match" actionLabel="Create role" onAction={onAction} />
				</SelectContent>
			</Select>,
		);
		expect(screen.getByText("No roles match")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Create role" }));
		expect(onAction).toHaveBeenCalledTimes(1);
	});

	it("opens on the keyboard shortcut and closes via Escape (feature 4)", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		render(
			<Select shortcut="⌘K" ariaLabel="Shortcut select">
				<SelectTrigger>
					<SelectValue placeholder="Pick…" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="a">Option A</SelectItem>
				</SelectContent>
			</Select>,
		);
		const trigger = screen.getByRole("combobox", { name: "Shortcut select" });
		// Not open yet.
		expect(screen.queryByText("Option A")).toBeNull();

		fireEvent.keyDown(window, { key: "k", metaKey: true });
		expect(screen.getByText("Option A")).toBeTruthy();

		// Escape closes the popup.
		fireEvent.keyDown(trigger, { key: "Escape" });
		expect(screen.queryByText("Option A")).toBeNull();
	});

	it("announces the selection in an sr-only live region (feature 8)", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		const { container } = render(<SingleSelectHarness />);

		act(() => {
			fireEvent.click(screen.getByRole("combobox", { name: "Pick a language" }));
		});
		act(() => {
			fireEvent.click(screen.getByText("TypeScript"));
		});

		const liveRegion = container.querySelector('[data-slot="select-live-region"]');
		expect(liveRegion).toBeTruthy();
		expect(liveRegion?.textContent).toBe("Selected ts");
	});

	it("renders a value→label map via itemToStringLabel so the trigger shows the label (feature 5)", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);

		function LabelHarness(): React.JSX.Element {
			const [value, setValue] = useState<string | null>(null);
			const handleChange = useCallback((next: string | null): void => {
				setValue(next);
			}, []);
			return (
				<Select value={value} onValueChange={handleChange} itemToStringLabel={labelOf} ariaLabel="Label select">
					<SelectTrigger>
						<SelectValue placeholder="Pick…" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="js">JavaScript</SelectItem>
					</SelectContent>
				</Select>
			);
		}

		render(<LabelHarness />);
		act(() => {
			fireEvent.click(screen.getByRole("combobox", { name: "Label select" }));
		});
		act(() => {
			fireEvent.click(screen.getByText("JavaScript"));
		});
		// The trigger's value slot now shows the label, not the raw value "js"
		// (the popup stays mounted in jsdom, so scope to the trigger's value slot).
		const valueSlot = document.querySelector('[data-slot="select-value"]');
		expect(valueSlot?.textContent).toBe("JavaScript");
		// The live region also announces the label, not the raw value.
		const liveRegion = document.querySelector('[data-slot="select-live-region"]');
		expect(liveRegion?.textContent).toBe("Selected JavaScript");
	});

	it("clears without toggling the popup via SelectClear (feature 7)", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		const onClear = vi.fn();

		function ClearHarness(): React.JSX.Element {
			const [value, setValue] = useState<string | null>("a");
			return (
				<Select value={value} onValueChange={setValue} ariaLabel="Clearable">
					<SelectTrigger>
						<SelectValue placeholder="Pick…" />
						{value !== null ? <SelectClear onClear={onClear} /> : null}
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="a">Option A</SelectItem>
					</SelectContent>
				</Select>
			);
		}

		render(<ClearHarness />);
		const clear = screen.getByRole("button", { name: "Clear selection" });
		act(() => {
			fireEvent.click(clear);
		});
		expect(onClear).toHaveBeenCalledTimes(1);
		// The popup must NOT have opened (the click was stopped).
		expect(screen.queryByText("Option A")).toBeNull();
	});

	it("renders groups, labels and separators (improvements 15 + 20)", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		render(
			<Select defaultOpen ariaLabel="Grouped">
				<SelectTrigger>
					<SelectValue placeholder="Pick…" />
				</SelectTrigger>
				<SelectContent>
					<SelectGroup>
						<SelectLabel>Engineering</SelectLabel>
						<SelectItem value="platform">Platform</SelectItem>
						<SelectSeparator />
						<SelectItem value="data">Data</SelectItem>
					</SelectGroup>
				</SelectContent>
			</Select>,
		);
		expect(screen.getByText("Engineering")).toBeTruthy();
		expect(screen.getByText("Platform")).toBeTruthy();
		expect(document.querySelector('[data-slot="select-separator"]')).toBeTruthy();
	});

	it("forwards disabled to the trigger (improvement 18)", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		render(
			<Select disabled ariaLabel="Disabled select">
				<SelectTrigger>
					<SelectValue placeholder="Pick…" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="a">Option A</SelectItem>
				</SelectContent>
			</Select>,
		);
		expect(screen.getByRole("combobox", { name: "Disabled select" }).getAttribute("disabled")).not.toBeNull();
	});

	it("selectA11yProps exposes the wrapper-controlled attributes (feature 18)", () => {
		const contract: SelectA11yContract = selectA11yProps("sm");
		expect(contract.role).toBe("combobox");
		expect(contract.ariaHaspopup).toBe("listbox");
		expect(contract.dataSize).toBe("sm");
	});

	it("threads the invalid state to the trigger as aria-invalid (rule 18)", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		render(
			<Select invalid ariaLabel="Invalid select">
				<SelectTrigger>
					<SelectValue placeholder="Pick…" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="a">Option A</SelectItem>
				</SelectContent>
			</Select>,
		);
		const trigger = screen.getByRole("combobox", { name: "Invalid select" });
		expect(trigger.getAttribute("aria-invalid")).toBe("true");
	});

	it("renders chips for multiple selections and removes one via the chip affordance (multi)", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);

		function MultiHarness(): React.JSX.Element {
			const [values, setValues] = useState<string[]>(["platform", "data"]);
			const removeValue = useCallback((value: string): void => {
				setValues((current) => current.filter((item) => item !== value));
			}, []);
			return (
				<div>
					<Select multiple value={values} onValueChange={setValues} ariaLabel="Teams">
						<SelectTrigger>
							{values.length > 0 ? (
								<SelectChips>
									{values.map((value) => (
										<SelectChip key={value} value={value} label={value} onRemove={removeValue} />
									))}
								</SelectChips>
							) : (
								<SelectValue placeholder="Pick teams…" />
							)}
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="platform">Platform</SelectItem>
							<SelectItem value="data">Data</SelectItem>
						</SelectContent>
					</Select>
				</div>
			);
		}

		render(<MultiHarness />);
		const chips = screen.getAllByText("platform");
		expect(chips.length).toBeGreaterThan(0);
		expect(document.querySelector('[data-slot="select-chip"]')).toBeTruthy();

		// Remove "platform" via its chip affordance.
		act(() => {
			fireEvent.click(screen.getByRole("button", { name: "Remove platform" }));
		});
		expect(document.querySelector('[data-slot="select-chip"][data-value="platform"]')).toBeNull();
		expect(document.querySelector('[data-slot="select-chip"][data-value="data"]')).toBeTruthy();
	});

	it("caps the visible chips and shows an overflow pill (multi)", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		const removeValue = vi.fn();
		render(
			<Select multiple defaultOpen ariaLabel="Capped">
				<SelectTrigger>
					<SelectChips maxChips={1}>
						<SelectChip value="a" label="Alpha" onRemove={removeValue} />
						<SelectChip value="b" label="Beta" onRemove={removeValue} />
						<SelectChip value="c" label="Gamma" onRemove={removeValue} />
					</SelectChips>
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="a">Alpha</SelectItem>
				</SelectContent>
			</Select>,
		);
		// Scope to the chips row (the popup is also mounted with defaultOpen, and
		// its “Alpha” item would otherwise collide with the chip's text).
		const chipsRow = document.querySelector('[data-slot="select-chips"]');
		expect(chipsRow?.textContent).toContain("Alpha");
		expect(chipsRow?.textContent).toContain("+2");
		expect(chipsRow?.textContent).not.toContain("Beta");
	});

	it("clears every selection via SelectClearAll (multi)", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		const onClearAll = vi.fn();
		render(<SelectClearAll onClearAll={onClearAll} />);
		fireEvent.click(screen.getByRole("button", { name: "Clear all selections" }));
		expect(onClearAll).toHaveBeenCalledTimes(1);
	});

	it("renders SelectClear inside a controlled single-select trigger and clears without toggling (RHF pattern)", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);

		function ClearHarness(): React.JSX.Element {
			const [value, setValue] = useState<string>("ts");
			const clear = useCallback((): void => {
				setValue("");
			}, []);
			const handleChange = useCallback((next: string | null): void => {
				setValue(next ?? "");
			}, []);
			return (
				<Select value={value} onValueChange={handleChange} itemToStringLabel={labelOf} ariaLabel="Language">
					<SelectTrigger>
						<SelectValue placeholder="Pick a language…" />
						{value !== "" ? <SelectClear onClear={clear} /> : null}
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="ts">TypeScript</SelectItem>
						<SelectItem value="py">Python</SelectItem>
					</SelectContent>
				</Select>
			);
		}

		render(<ClearHarness />);
		const trigger = screen.getByRole("combobox", { name: "Language" });
		const clear = screen.getByRole("button", { name: "Clear selection" });

		// Clicking the clear runs the smart component's handler and does NOT
		// open the popup (the shared stop-propagation handlers contain the event).
		// Assert via `aria-expanded` — base-ui mounts the popup content in a
		// hidden state after any state change, so `queryByText` would find it.
		act(() => {
			fireEvent.click(clear);
		});
		expect(trigger.getAttribute("aria-expanded")).toBe("false");
		expect(screen.queryByRole("button", { name: "Clear selection" })).toBeNull();
		expect(document.querySelector('[data-slot="select-value"]')?.textContent).toBe("Pick a language…");
	});
});
