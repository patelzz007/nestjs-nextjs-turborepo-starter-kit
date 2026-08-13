// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Input } from "./input";
import { InputGroupInput, InputGroupTextarea } from "./input-group";
import { NativeSelect, NativeSelectOption } from "./native-select";
import { PasswordInput } from "./password-input";
import { Textarea } from "./textarea";

afterEach((): void => {
	cleanup();
});

// Rule 20 — ref forwarding: RHF `register()` and focus management attach a
// ref to the actual DOM control, so every form primitive must forward it.
describe("form primitives forward refs (rule 20)", () => {
	it("Input forwards its ref to the native input", (): void => {
		const ref: { readonly current: HTMLInputElement | null } = { current: null };

		render(<Input ref={ref} data-testid="input" />);
		const input = screen.getByTestId("input");
		expect(ref.current).toBe(input);
		expect(ref.current).toBeInstanceOf(HTMLInputElement);
	});

	it("Textarea forwards its ref to the native textarea", (): void => {
		const ref: { readonly current: HTMLTextAreaElement | null } = { current: null };

		render(<Textarea ref={ref} data-testid="textarea" />);
		const textarea = screen.getByTestId("textarea");
		expect(ref.current).toBe(textarea);
		expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
	});

	it("NativeSelect forwards its ref to the native select", (): void => {
		const ref: { readonly current: HTMLSelectElement | null } = { current: null };

		render(
			<NativeSelect ref={ref} data-testid="select">
				<NativeSelectOption value="a">A</NativeSelectOption>
			</NativeSelect>,
		);
		const select = screen.getByTestId("select");
		expect(ref.current).toBe(select);
		expect(ref.current).toBeInstanceOf(HTMLSelectElement);
	});

	it("InputGroupInput forwards its ref to the inner input", (): void => {
		const ref: { readonly current: HTMLInputElement | null } = { current: null };

		render(<InputGroupInput ref={ref} data-testid="group-input" />);
		const input = screen.getByTestId("group-input");
		expect(ref.current).toBe(input);
		expect(ref.current).toBeInstanceOf(HTMLInputElement);
	});

	it("InputGroupTextarea forwards its ref to the inner textarea", (): void => {
		const ref: { readonly current: HTMLTextAreaElement | null } = { current: null };

		render(<InputGroupTextarea ref={ref} data-testid="group-textarea" />);
		const textarea = screen.getByTestId("group-textarea");
		expect(ref.current).toBe(textarea);
		expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
	});

	it("PasswordInput forwards its ref to the inner input", (): void => {
		const ref: { readonly current: HTMLInputElement | null } = { current: null };

		render(<PasswordInput ref={ref} data-testid="password" />);
		const input = screen.getByTestId("password");
		expect(ref.current).toBe(input);
		expect(ref.current).toBeInstanceOf(HTMLInputElement);
	});
});

// Rule 21 — consistent event contract: onBlur/onChange/onFocus must always be
// exposed, and internal handlers must never clobber consumer handlers.
describe("form primitives keep a consistent event contract (rule 21)", () => {
	it("PasswordInput composes onKeyDown/onKeyUp with the caps-lock detector", (): void => {
		const onKeyDown = vi.fn();
		const onKeyUp = vi.fn();
		const onChange = vi.fn();

		// jsdom's KeyboardEvent.prototype.getModifierState cannot be overridden
		// via event init, so stub the prototype (the component calls it on the
		// received event).
		const getModifierState = vi.spyOn(KeyboardEvent.prototype, "getModifierState").mockReturnValue(true);

		try {
			render(<PasswordInput onKeyDown={onKeyDown} onKeyUp={onKeyUp} onChange={onChange} data-testid="password" />);
			const input = screen.getByTestId("password");

			fireEvent.keyDown(input, { key: "a" });
			expect(onKeyDown).toHaveBeenCalledTimes(1);
			expect(getModifierState).toHaveBeenCalledWith("CapsLock");
			// Caps-lock hint appears (the internal detector ran too).
			expect(screen.getByText("Caps Lock is on")).toBeTruthy();

			getModifierState.mockReturnValue(false);
			fireEvent.keyUp(input, { key: "a" });
			expect(onKeyUp).toHaveBeenCalledTimes(1);
			expect(screen.queryByText("Caps Lock is on")).toBeNull();

			fireEvent.change(input, { target: { value: "secret" } });
			expect(onChange).toHaveBeenCalledTimes(1);
		} finally {
			getModifierState.mockRestore();
		}
	});

	it("PasswordInput clears the caps-lock hint on blur and still calls onBlur", (): void => {
		const onBlur = vi.fn();

		const getModifierState = vi.spyOn(KeyboardEvent.prototype, "getModifierState").mockReturnValue(true);

		try {
			render(<PasswordInput onBlur={onBlur} data-testid="password" />);
			const input = screen.getByTestId("password");

			fireEvent.keyDown(input, { key: "a" });
			expect(screen.getByText("Caps Lock is on")).toBeTruthy();

			fireEvent.blur(input);
			expect(onBlur).toHaveBeenCalledTimes(1);
			expect(screen.queryByText("Caps Lock is on")).toBeNull();
		} finally {
			getModifierState.mockRestore();
		}
	});
});
