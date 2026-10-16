import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import type { View } from "react-native";

import { TextLink, textLinkVariants } from "../text-link";

describe("TextLink", () => {
	it("is an accessible link with a lead-in, and reports presses", async () => {
		const onPress = jest.fn();
		await render(<TextLink label="Create one" leadIn="Don't have an account?" onPress={onPress} />);

		expect(screen.getByText("Don't have an account?")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("link", { name: "Create one" }));
		expect(onPress).toHaveBeenCalledTimes(1);
	});

	it("is a button when it acts in place", async () => {
		await render(<TextLink label="Sign out" role="button" variant="destructive" onPress={jest.fn()} />);
		expect(screen.getByRole("button", { name: "Sign out" })).toBeOnTheScreen();
	});

	it("blocks presses while disabled or loading", async () => {
		const onPress = jest.fn();
		await render(<TextLink label="Resend code" onPress={onPress} loading />);

		const link = screen.getByRole("link", { name: "Resend code" });
		expect(link).toBeBusy();
		expect(link).toBeDisabled();
		await fireEvent.press(link);
		expect(onPress).not.toHaveBeenCalled();

		await render(<TextLink label="Resend code" onPress={onPress} disabled />);
		expect(screen.getByRole("link", { name: "Resend code" })).toBeDisabled();
	});

	it("reaches a 44 pt touch area and has variants and sizes", async () => {
		await render(<TextLink label="Forgot password?" onPress={jest.fn()} />);

		expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveProp("hitSlop", 8);
		expect(textLinkVariants({ variant: "muted" })).toContain("text-muted-foreground");
		expect(textLinkVariants({ size: "md" })).toContain("text-base");
	});

	it("reports focus and blur", async () => {
		const onFocus = jest.fn();
		const onBlur = jest.fn();
		await render(<TextLink label="Help" onPress={jest.fn()} onFocus={onFocus} onBlur={onBlur} />);

		await fireEvent(screen.getByRole("link", { name: "Help" }), "focus");
		await fireEvent(screen.getByRole("link", { name: "Help" }), "blur");
		expect(onFocus).toHaveBeenCalledTimes(1);
		expect(onBlur).toHaveBeenCalledTimes(1);
	});

	it("forwards its ref to the pressable and merges the caller's className last on its row", async () => {
		const ref = React.createRef<View>();
		await render(<TextLink ref={ref} label="Help" onPress={jest.fn()} className="justify-start gap-2" />);

		expect(ref.current).not.toBeNull();
		const row = screen.getByRole("link", { name: "Help" }).parent;
		const className = String(row?.props.className);
		expect(className).toContain("justify-start");
		expect(className).not.toContain("justify-center");
	});
});
