// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { useFocusShortcut } from "./use-focus-shortcut";

function Harness(): React.JSX.Element {
	const inputRef = React.useRef<HTMLInputElement>(null);
	useFocusShortcut(inputRef, "/");
	return (
		<>
			<input aria-label="Target" ref={inputRef} />
			<textarea aria-label="Elsewhere" />
		</>
	);
}

afterEach((): void => {
	cleanup();
});

describe("useFocusShortcut", () => {
	it("focuses the target when the key is pressed outside a text field", () => {
		render(<Harness />);
		fireEvent.keyDown(window, { key: "/" });
		expect(document.activeElement).toBe(screen.getByLabelText("Target"));
	});

	it("ignores the key while typing elsewhere, with a modifier, or on repeat", () => {
		render(<Harness />);
		const elsewhere = screen.getByLabelText("Elsewhere");
		elsewhere.focus();
		fireEvent.keyDown(elsewhere, { key: "/" });
		fireEvent.keyDown(window, { key: "/", metaKey: true });
		fireEvent.keyDown(window, { key: "/", repeat: true });
		expect(document.activeElement).toBe(elsewhere);
	});
});
