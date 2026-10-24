import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import { Text, type ViewInstance } from "react-native";

import { CoverImage } from "../cover-image";

const PHOTO_URI = "https://cdn.example.com/products/espresso.jpg";

describe("CoverImage", () => {
	it("shows the picture, named by its alt text, filling a 16:9 frame by default", async () => {
		await render(<CoverImage uri={PHOTO_URI} alt="An espresso on a marble counter" testID="cover" />);

		const image = screen.getByLabelText("An espresso on a marble counter");
		// expo-image normalises `source` to a list of candidates.
		expect(image).toHaveProp("source", expect.arrayContaining([expect.objectContaining({ uri: PHOTO_URI })]));
		expect(image).toHaveProp("contentFit", "cover");
		expect(screen.getByTestId("cover")).toHaveProp("className", expect.stringContaining("aspect-video"));
	});

	it("holds the space with a placeholder image when there is no picture", async () => {
		await render(<CoverImage uri={null} alt="No product photo" testID="cover" />);

		expect(screen.getByRole("image", { name: "No product photo" })).toBeOnTheScreen();
		expect(screen.queryByTestId("cover-image")).toBeNull();
	});

	it("falls back to the placeholder when the picture fails to load, and tries a new address again", async () => {
		const { rerender } = await render(<CoverImage uri={PHOTO_URI} alt="Espresso" testID="cover" fallback={<Text className="font-sans">No photo</Text>} />);

		await fireEvent(screen.getByTestId("cover-image"), "error", { nativeEvent: { error: "404" } });
		expect(screen.getByText("No photo")).toBeOnTheScreen();
		expect(screen.queryByTestId("cover-image")).toBeNull();

		await rerender(<CoverImage uri="https://cdn.example.com/products/latte.jpg" alt="Latte" testID="cover" />);
		expect(screen.getByTestId("cover-image")).toBeOnTheScreen();
	});

	it.each([
		["video", "aspect-video"],
		["photo", "aspect-4/3"],
		["square", "aspect-square"],
		["portrait", "aspect-3/4"],
	] satisfies [React.ComponentProps<typeof CoverImage>["ratio"], string][])("has a %s ratio", async (ratio, expectedClass) => {
		await render(<CoverImage uri={null} alt="Photo" ratio={ratio} testID="cover" />);
		expect(screen.getByTestId("cover")).toHaveProp("className", expect.stringContaining(expectedClass));
	});

	it("is rounded by default and flush inside a frame that clips it", async () => {
		await render(<CoverImage uri={null} alt="Rounded" testID="rounded" />);
		expect(screen.getByTestId("rounded")).toHaveProp("className", expect.stringContaining("rounded-xl"));
		await render(<CoverImage uri={null} alt="Flush" variant="flush" testID="flush" />);
		expect(screen.getByTestId("flush")).toHaveProp("className", expect.stringContaining("rounded-none"));
	});

	it("merges the caller's className last", async () => {
		await render(<CoverImage uri={null} alt="Photo" className="w-40 rounded-sm" testID="cover" />);
		const className = String(screen.getByTestId("cover").props.className);
		expect(className).toContain("w-40");
		expect(className).toContain("rounded-sm");
		expect(className).not.toContain("rounded-xl");
	});

	it("forwards its ref", async () => {
		const ref = React.createRef<ViewInstance>();
		await render(<CoverImage ref={ref} uri={PHOTO_URI} alt="Photo" />);
		expect(ref.current).not.toBeNull();
	});
});
