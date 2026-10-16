// Shared fixtures for the cascader tests: a small typed tree, a full popup
// composition, and the ResizeObserver base-ui's popup needs in jsdom.

import { act, fireEvent, screen } from "@testing-library/react";
import { Cascader, CascaderContent, CascaderEmpty, CascaderList, CascaderPanel, CascaderStatus, CascaderTrigger } from "@workspace/ui/components/cascader/cascader";
import type { CascaderProps } from "@workspace/ui/components/cascader/cascader";
import { CascaderItems } from "@workspace/ui/components/cascader/cascader-item";
import { CascaderBreadcrumb, CascaderInput, CascaderNav, CascaderValue } from "@workspace/ui/components/cascader/cascader-nav";
import type { CascaderNode } from "@workspace/ui/components/cascader/cascader-types";
import * as React from "react";
import { vi } from "vitest";

export interface Produce {
	readonly kcal: number;
}

/** Fruit > (Apple, Pear), Vegetables > (Carrot, Leafy > (Kale)), Herbs (disabled) > Basil. */
export const PRODUCE: readonly CascaderNode<Produce>[] = [
	{
		value: "fruit",
		label: "Fruit",
		children: [
			{ value: "apple", label: "Apple", data: { kcal: 52 }, keywords: ["pomme"] },
			{ value: "pear", label: "Pear", data: { kcal: 57 } },
		],
	},
	{
		value: "veg",
		label: "Vegetables",
		children: [
			{ value: "carrot", label: "Carrot", data: { kcal: 41 } },
			{ value: "leafy", label: "Leafy", children: [{ value: "kale", label: "Kale", data: { kcal: 49 } }] },
		],
	},
	{ value: "herbs", label: "Herbs", disabled: true, children: [{ value: "basil", label: "Basil" }] },
];

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

/** Gives jsdom the ResizeObserver base-ui's popup needs. Undo with `vi.unstubAllGlobals()`. */
export function stubCascaderResizeObserver(): void {
	vi.stubGlobal("ResizeObserver", ResizeObserverStub);
	// base-ui's ScrollArea waits on the viewport's animations, which jsdom does not implement.
	if (!("getAnimations" in Element.prototype)) {
		Object.defineProperty(Element.prototype, "getAnimations", { configurable: true, value: noAnimations });
	}
}

function noAnimations(): Animation[] {
	return [];
}

export type ProducePickerProps = CascaderProps<Produce> & {
	readonly panelChildren?: React.ReactNode;
};

/** The standard popup composition the reui docs use, with a named trigger. */
export function ProducePicker({ panelChildren, ...props }: ProducePickerProps): React.JSX.Element {
	return (
		<Cascader {...props}>
			<CascaderTrigger aria-label="Produce">
				<CascaderValue placeholder="Pick produce" />
			</CascaderTrigger>
			<CascaderContent>
				<CascaderPanel>
					<CascaderNav>
						<CascaderInput />
					</CascaderNav>
					<CascaderBreadcrumb />
					{panelChildren ?? (
						<CascaderList>
							<CascaderItems />
						</CascaderList>
					)}
					<CascaderEmpty />
					<CascaderStatus />
				</CascaderPanel>
			</CascaderContent>
		</Cascader>
	);
}

/** Opens the popup through its trigger. */
export function openPicker(): void {
	act((): void => {
		fireEvent.click(screen.getByRole("combobox", { name: "Produce" }));
	});
}

/** The search field inside the open popup. */
export function searchField(): HTMLElement {
	const [field] = screen.getAllByRole("combobox").filter((element: HTMLElement): boolean => element.tagName === "INPUT");
	if (field === undefined) {
		throw new Error("The cascader search field is not mounted");
	}
	return field;
}

/** Presses a row the way base-ui commits: a pointer press, then the click. */
export function pressRow(name: string | RegExp): void {
	const row = screen.getByRole("option", { name });
	act((): void => {
		fireEvent.pointerDown(row, { pointerType: "mouse" });
		fireEvent.click(row);
	});
}

/** Sends one key to the search field. */
export function pressKey(key: string): void {
	act((): void => {
		fireEvent.keyDown(searchField(), { key });
	});
}

/** The visible option names, in order. */
export function optionNames(): string[] {
	return screen.getAllByRole("option").map((option: HTMLElement): string => option.querySelector("span.truncate")?.textContent ?? "");
}
