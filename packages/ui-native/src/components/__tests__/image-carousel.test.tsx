import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import type { ViewInstance } from "react-native";

import { ImageCarousel, type ImageCarouselImage } from "../image-carousel";

const IMAGES: readonly ImageCarouselImage[] = [
	{ id: "front", uri: "https://cdn.example.com/bag/front.jpg", alt: "The bag from the front" },
	{ id: "side", uri: "https://cdn.example.com/bag/side.jpg", alt: "The bag from the side" },
	{ id: "inside", uri: "https://cdn.example.com/bag/inside.jpg", alt: "The bag's lining" },
];
const SECOND_IMAGE = 1;
const LAST_IMAGE = 2;

function photoLabel(position: number, total: number): string {
	return `Photo ${String(position)} of ${String(total)}`;
}

describe("ImageCarousel", () => {
	it("shows the current picture, named by its alt text, with a dot per picture", async () => {
		await render(<ImageCarousel images={IMAGES} index={SECOND_IMAGE} onChange={jest.fn()} />);

		expect(screen.getByLabelText("The bag from the side")).toBeOnTheScreen();
		expect(screen.queryByLabelText("The bag from the front")).toBeNull();
		expect(screen.getByRole("button", { name: "Slide 2 of 3" })).toBeSelected();
	});

	it("reports the picture a dot asks for, and names dots with the caller's label", async () => {
		const onChange = jest.fn();
		await render(<ImageCarousel images={IMAGES} index={0} onChange={onChange} slideLabel={photoLabel} />);

		await fireEvent.press(screen.getByRole("button", { name: "Photo 3 of 3" }));
		expect(onChange).toHaveBeenCalledWith(LAST_IMAGE);
	});

	it("frames every picture in the caller's ratio", async () => {
		await render(<ImageCarousel images={IMAGES} index={0} onChange={jest.fn()} ratio="square" testID="gallery" />);
		expect(screen.getByTestId("gallery-front")).toHaveProp("className", expect.stringContaining("aspect-square"));
		expect(screen.getByTestId("gallery-front")).toHaveProp("className", expect.stringContaining("rounded-xl"));
	});

	it("sits flush inside a card in the card variant, merging the caller's className last", async () => {
		await render(<ImageCarousel images={IMAGES} index={0} onChange={jest.fn()} variant="card" size="sm" className="mt-4" testID="gallery" />);
		const className = String(screen.getByTestId("gallery").props.className);
		expect(className).toContain("bg-card");
		expect(className).toContain("mt-4");
		expect(screen.getByTestId("gallery-front")).toHaveProp("className", expect.stringContaining("rounded-none"));
	});

	it("holds a picture that has no address yet with the cover's placeholder", async () => {
		await render(<ImageCarousel images={[{ id: "pending", uri: null, alt: "Photo still processing" }]} index={0} onChange={jest.fn()} />);
		expect(screen.getByRole("image", { name: "Photo still processing" })).toBeOnTheScreen();
	});

	it("renders one picture as a plain cover: no dots, arrows or counter", async () => {
		const [front] = IMAGES;
		if (front === undefined) {
			throw new Error("no fixture picture");
		}
		await render(<ImageCarousel images={[front]} index={0} onChange={jest.fn()} showControls className="mt-4" testID="gallery" />);

		expect(screen.getByLabelText("The bag from the front")).toBeOnTheScreen();
		expect(screen.queryAllByRole("button")).toHaveLength(0);
		expect(screen.queryByText("1 / 1")).toBeNull();
		expect(screen.getByTestId("gallery-front")).toHaveProp("className", expect.stringContaining("mt-4"));
	});

	it("marks each picture with its position, hidden from screen readers, unless asked not to", async () => {
		const { rerender } = await render(<ImageCarousel images={IMAGES} index={SECOND_IMAGE} onChange={jest.fn()} />);
		expect(screen.getByText("2 / 3", { includeHiddenElements: true })).toBeOnTheScreen();
		expect(screen.queryByText("2 / 3")).toBeNull();

		await rerender(<ImageCarousel images={IMAGES} index={SECOND_IMAGE} onChange={jest.fn()} showCounter={false} />);
		expect(screen.queryByText("2 / 3", { includeHiddenElements: true })).toBeNull();
	});

	it("passes the arrows and their names through to the carousel", async () => {
		const onChange = jest.fn();
		await render(<ImageCarousel images={IMAGES} index={SECOND_IMAGE} onChange={onChange} showControls nextLabel="Next photo" />);

		await fireEvent.press(screen.getByRole("button", { name: "Next photo" }));
		expect(onChange).toHaveBeenCalledWith(LAST_IMAGE);
		expect(screen.getByRole("button", { name: "Previous slide" })).toBeEnabled();
	});

	it("forwards its ref", async () => {
		const ref = React.createRef<ViewInstance>();
		await render(<ImageCarousel ref={ref} images={IMAGES} index={0} onChange={jest.fn()} />);
		expect(ref.current).not.toBeNull();
	});
});
