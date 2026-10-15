import { fireEvent, render, screen } from "@testing-library/react-native";
import ImagePlusIcon from "lucide-react-native/icons/image-plus";
import * as React from "react";
import type { View } from "react-native";

import { IconButton } from "./icon-button";

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
		const ref = React.createRef<View>();
		await render(<IconButton ref={ref} icon={ImagePlusIcon} label="Add a picture" onPress={jest.fn()} />);
		expect(ref.current).not.toBeNull();
	});
});
