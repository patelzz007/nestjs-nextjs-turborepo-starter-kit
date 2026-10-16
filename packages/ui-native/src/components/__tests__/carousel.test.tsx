import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import { Text, type View } from "react-native";

import { Carousel, clampCarouselIndex, defaultCarouselSlideLabel } from "../carousel";

const PAGE_WIDTH = 300;
const SECOND_SLIDE = 1;
const THIRD_SLIDE = 2;
/** The second slide's position as people count it. */
const SECOND_POSITION = 2;
const SLIDE_TITLES: readonly string[] = ["Welcome", "Rewards", "Security"];

function slides(): React.JSX.Element[] {
	return SLIDE_TITLES.map((title: string): React.JSX.Element => (
		<Text key={title} className="font-sans">
			{title}
		</Text>
	));
}

function pageLabel(position: number, total: number): string {
	return `Page ${String(position)}/${String(total)}`;
}

/** Lays the carousel out at PAGE_WIDTH and swipes the pager to `page`. */
async function swipeTo(page: number): Promise<void> {
	await fireEvent(screen.getByTestId("carousel"), "layout", { nativeEvent: { layout: { width: PAGE_WIDTH, height: PAGE_WIDTH, x: 0, y: 0 } } });
	await fireEvent(screen.getByTestId("carousel-pager"), "momentumScrollEnd", { nativeEvent: { contentOffset: { x: page * PAGE_WIDTH, y: 0 } } });
}

describe("Carousel", () => {
	it("names each slide's dot 'Slide n of total' and marks the current one selected", async () => {
		await render(
			<Carousel index={SECOND_SLIDE} onChange={jest.fn()}>
				{slides()}
			</Carousel>,
		);

		expect(screen.getByRole("button", { name: "Slide 1 of 3" })).not.toBeSelected();
		expect(screen.getByRole("button", { name: "Slide 2 of 3" })).toBeSelected();
		expect(screen.getByRole("button", { name: "Slide 3 of 3" })).not.toBeSelected();
	});

	it("takes the caller's slide label", async () => {
		await render(
			<Carousel index={0} onChange={jest.fn()} slideLabel={pageLabel}>
				{slides()}
			</Carousel>,
		);
		expect(screen.getByRole("button", { name: "Page 3/3" })).toBeOnTheScreen();
		expect(defaultCarouselSlideLabel(SECOND_POSITION, SLIDE_TITLES.length)).toBe("Slide 2 of 3");
	});

	it("reports the slide a dot asks for", async () => {
		const onChange = jest.fn();
		await render(
			<Carousel index={0} onChange={onChange}>
				{slides()}
			</Carousel>,
		);
		await fireEvent.press(screen.getByRole("button", { name: "Slide 3 of 3" }));
		expect(onChange).toHaveBeenCalledWith(THIRD_SLIDE);
	});

	it("reports the page a swipe settles on, and only when it changed", async () => {
		const onChange = jest.fn();
		await render(
			<Carousel index={0} onChange={onChange} testID="carousel">
				{slides()}
			</Carousel>,
		);

		await swipeTo(SECOND_SLIDE);
		expect(onChange).toHaveBeenCalledWith(SECOND_SLIDE);

		onChange.mockClear();
		await swipeTo(0);
		expect(onChange).not.toHaveBeenCalled();
	});

	it("follows the controlled index: only the current slide is exposed to screen readers", async () => {
		const { rerender } = await render(
			<Carousel index={0} onChange={jest.fn()}>
				{slides()}
			</Carousel>,
		);
		expect(screen.getByText("Welcome")).toBeOnTheScreen();
		expect(screen.queryByText("Rewards")).toBeNull();

		await rerender(
			<Carousel index={SECOND_SLIDE} onChange={jest.fn()}>
				{slides()}
			</Carousel>,
		);
		expect(screen.getByText("Rewards")).toBeOnTheScreen();
		expect(screen.queryByText("Welcome")).toBeNull();
	});

	it("can hide its dots", async () => {
		await render(
			<Carousel index={0} onChange={jest.fn()} showIndicators={false}>
				{slides()}
			</Carousel>,
		);
		expect(screen.queryByRole("button", { name: "Slide 1 of 3" })).toBeNull();
	});

	it("draws a card surface and smaller dots on request, merging the caller's className last", async () => {
		await render(
			<Carousel index={0} onChange={jest.fn()} variant="card" size="sm" className="mt-4 gap-4" testID="carousel">
				{slides()}
			</Carousel>,
		);
		const className = String(screen.getByTestId("carousel").props.className);
		expect(className).toContain("bg-card");
		expect(className).toContain("mt-4");
		expect(className).toContain("gap-4");
		expect(className).not.toContain("gap-1");
	});

	it("adds previous / next arrows on request, each reporting its neighbour and disabled at its end", async () => {
		const onChange = jest.fn();
		const { rerender } = await render(
			<Carousel index={0} onChange={onChange} showControls>
				{slides()}
			</Carousel>,
		);
		expect(screen.getByRole("button", { name: "Previous slide" })).toBeDisabled();
		await fireEvent.press(screen.getByRole("button", { name: "Next slide" }));
		expect(onChange).toHaveBeenLastCalledWith(SECOND_SLIDE);

		await rerender(
			<Carousel index={THIRD_SLIDE} onChange={onChange} showControls previousLabel="Back" nextLabel="Forward">
				{slides()}
			</Carousel>,
		);
		expect(screen.getByRole("button", { name: "Forward" })).toBeDisabled();
		await fireEvent.press(screen.getByRole("button", { name: "Back" }));
		expect(onChange).toHaveBeenLastCalledWith(SECOND_SLIDE);
	});

	it("keeps the arrows without the dots", async () => {
		await render(
			<Carousel index={0} onChange={jest.fn()} showControls showIndicators={false}>
				{slides()}
			</Carousel>,
		);
		expect(screen.getByRole("button", { name: "Next slide" })).toBeOnTheScreen();
		expect(screen.queryByRole("button", { name: "Slide 1 of 3" })).toBeNull();
	});

	it("clamps an index to the slides", () => {
		expect(clampCarouselIndex(-1, SLIDE_TITLES.length)).toBe(0);
		expect(clampCarouselIndex(SECOND_SLIDE, SLIDE_TITLES.length)).toBe(SECOND_SLIDE);
		expect(clampCarouselIndex(SLIDE_TITLES.length, SLIDE_TITLES.length)).toBe(THIRD_SLIDE);
		expect(clampCarouselIndex(SECOND_SLIDE, 0)).toBe(0);
	});

	it("forwards its ref", async () => {
		const ref = React.createRef<View>();
		await render(
			<Carousel ref={ref} index={0} onChange={jest.fn()}>
				{slides()}
			</Carousel>,
		);
		expect(ref.current).not.toBeNull();
	});
});
