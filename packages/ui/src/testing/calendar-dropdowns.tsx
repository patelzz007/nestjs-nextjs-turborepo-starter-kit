// Test helpers for the Calendar's month / year dropdowns (the UI kit Select,
// base-ui): open one by its accessible name, read its options, choose one.
// base-ui measures its popup, so jsdom needs a ResizeObserver; and it only
// commits a choice that started with a pointer press on the item.

import { act, fireEvent, screen } from "@testing-library/react";
import { vi } from "vitest";

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
export function stubResizeObserverForCalendarDropdowns(): void {
	vi.stubGlobal("ResizeObserver", ResizeObserverStub);
}

/** Opens the dropdown named `name` ("Choose the Month" / "Choose the Year"), unless it is open already, and returns its options. */
export function openCalendarDropdown(name: string): HTMLElement[] {
	const trigger = screen.getByRole("combobox", { name });
	if (trigger.getAttribute("aria-expanded") !== "true") {
		act((): void => {
			fireEvent.click(trigger);
		});
	}
	return screen.getAllByRole("option");
}

/** Every option's text in the dropdown named `name` (it is left open). */
export function calendarDropdownOptionTexts(name: string): string[] {
	return openCalendarDropdown(name).map((option: HTMLElement): string => option.textContent);
}

/** Opens the dropdown named `name` and chooses the option whose text is `optionText`. */
export function chooseCalendarDropdownOption(name: string, optionText: string): void {
	openCalendarDropdown(name);
	const option = screen.getByRole("option", { name: optionText });
	act((): void => {
		fireEvent.pointerDown(option, { pointerType: "mouse" });
		fireEvent.click(option);
	});
}
