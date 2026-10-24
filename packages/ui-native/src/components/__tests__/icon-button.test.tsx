import { fireEvent, render, screen } from "@testing-library/react-native";
import ImagePlusIcon from "lucide-react-native/icons/image-plus";
import * as React from "react";
import type { ViewInstance } from "react-native";

import { IconButton } from "../icon-button";

describe("IconButton", () => {
	it("is a button named by its label, which reports presses", async () => {
		const onPress = jest.fn();
		await render(<IconButton icon={ImagePlusIcon} label="Add a picture" accessibilityHint="Uploads a photo" onPress={onPress} />);

		await fireEvent.press(screen.getByRole("button", { name: "Add a picture" }));

		expect(onPress).toHaveBeenCalledTimes(1);
	});

	it("blocks presses and announces busy while loading, and can be disabled", async () => {
		const onPress = jest.fn();
		const { rerender } = await render(<IconButton icon={ImagePlusIcon} label="Add a picture" onPress={onPress} loading />);

		const busy = screen.getByRole("button", { name: "Add a picture" });
		expect(busy).toBeBusy();
		await fireEvent.press(busy);
		expect(onPress).not.toHaveBeenCalled();

		await rerender(<IconButton icon={ImagePlusIcon} label="Add a picture" onPress={onPress} disabled />);
		expect(screen.getByRole("button", { name: "Add a picture" })).toBeDisabled();
	});

	it("forwards its ref", async () => {
		const ref = React.createRef<ViewInstance>();
		await render(<IconButton ref={ref} icon={ImagePlusIcon} label="Add a picture" onPress={jest.fn()} />);
		expect(ref.current).not.toBeNull();
	});

	it("shows the caller's validation outcome as its error state, unless it is inactive", async () => {
		const { rerender } = await render(<IconButton icon={ImagePlusIcon} label="Add a picture" onPress={jest.fn()} invalid />);
		expect(screen.getByRole("button", { name: "Add a picture" })).toHaveProp("className", expect.stringContaining("border-destructive"));

		await rerender(<IconButton icon={ImagePlusIcon} label="Add a picture" onPress={jest.fn()} invalid loading />);
		expect(screen.getByRole("button", { name: "Add a picture" })).not.toHaveProp("className", expect.stringContaining("border-destructive"));

		await rerender(<IconButton icon={ImagePlusIcon} label="Add a picture" onPress={jest.fn()} invalid disabled />);
		const button = screen.getByRole("button", { name: "Add a picture" });
		expect(button).toBeDisabled();
		expect(button).not.toHaveProp("className", expect.stringContaining("border-destructive"));
	});

	it("has a compact size whose touch area still reaches 44 pt, and a filled variant", async () => {
		const { rerender } = await render(<IconButton icon={ImagePlusIcon} label="Add a picture" size="sm" onPress={jest.fn()} />);
		const compact = screen.getByRole("button", { name: "Add a picture" });
		expect(compact).toHaveProp("className", expect.stringContaining("size-9"));
		expect(compact).toHaveProp("hitSlop", 4);

		await rerender(<IconButton icon={ImagePlusIcon} label="Add a picture" variant="primary" onPress={jest.fn()} />);
		expect(screen.getByRole("button", { name: "Add a picture" })).toHaveProp("className", expect.stringContaining("bg-primary"));
	});

	it("merges the caller's className last, so layout classes win", async () => {
		await render(<IconButton icon={ImagePlusIcon} label="Add a picture" onPress={jest.fn()} className="self-end rounded-full" />);
		const className = String(screen.getByRole("button", { name: "Add a picture" }).props.className);
		expect(className).toContain("self-end");
		expect(className).toContain("rounded-full");
		expect(className).not.toContain("rounded-lg");
	});

	it("reports focus and blur (keyboard and switch-control users)", async () => {
		const onFocus = jest.fn();
		const onBlur = jest.fn();
		await render(<IconButton icon={ImagePlusIcon} label="Add a picture" onPress={jest.fn()} onFocus={onFocus} onBlur={onBlur} />);
		const button = screen.getByRole("button", { name: "Add a picture" });
		await fireEvent(button, "focus");
		await fireEvent(button, "blur");
		expect(onFocus).toHaveBeenCalledTimes(1);
		expect(onBlur).toHaveBeenCalledTimes(1);
	});
});
