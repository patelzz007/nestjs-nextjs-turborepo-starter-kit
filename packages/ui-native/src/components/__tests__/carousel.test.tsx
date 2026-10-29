import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import { AccessibilityInfo, Text, type ViewInstance } from "react-native";

import {
	Carousel,
	carouselGapOf,
	carouselSlideMetrics,
	clampCarouselIndex,
	DEFAULT_CAROUSEL_GAP,
	defaultCarouselSlideLabel,
	nextCarouselIndex,
	type CarouselProps,
} from "../carousel";

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
		const ref = React.createRef<ViewInstance>();
		await render(
			<Carousel ref={ref} index={0} onChange={jest.fn()}>
				{slides()}
			</Carousel>,
		);
		expect(ref.current).not.toBeNull();
	});
});

const PEEK = 24;
const GAP = 12;
const AUTO_PLAY_MS = 4000;
/** Long enough for any pending timer to have fired. */
const LONG_WAIT_MS = AUTO_PLAY_MS * 3;

/** A screen that owns the carousel's slide, shows which one is current and lets the carousel change it. */
function OwnedCarousel(props: Partial<CarouselProps>): React.JSX.Element {
	const [index, setIndex] = React.useState(0);
	return (
		<>
			<Text>{`Showing ${String(index)}`}</Text>
			<Carousel index={index} onChange={setIndex} testID="carousel" {...props}>
				{slides()}
			</Carousel>
		</>
	);
}

async function wait(ms: number): Promise<void> {
	await act((): void => {
		jest.advanceTimersByTime(ms);
	});
}

async function layOut(): Promise<void> {
	await fireEvent(screen.getByTestId("carousel"), "layout", { nativeEvent: { layout: { width: PAGE_WIDTH, height: PAGE_WIDTH, x: 0, y: 0 } } });
}

describe("Carousel peek", () => {
	it("narrows each slide so the next one shows, and snaps slide by slide", async () => {
		await render(
			<Carousel index={0} onChange={jest.fn()} peek={PEEK} gap={GAP} testID="carousel">
				{slides()}
			</Carousel>,
		);
		await layOut();

		const pager = screen.getByTestId("carousel-pager");
		expect(pager).toHaveProp("snapToInterval", PAGE_WIDTH - PEEK);
		expect(pager).not.toHaveProp("pagingEnabled");
	});

	it("settles on the slide a swipe snapped to", async () => {
		const onChange = jest.fn();
		await render(
			<Carousel index={0} onChange={onChange} peek={PEEK} gap={GAP} testID="carousel">
				{slides()}
			</Carousel>,
		);
		await layOut();

		await fireEvent(screen.getByTestId("carousel-pager"), "momentumScrollEnd", { nativeEvent: { contentOffset: { x: THIRD_SLIDE * (PAGE_WIDTH - PEEK), y: 0 } } });

		expect(onChange).toHaveBeenCalledWith(THIRD_SLIDE);
	});

	it("pages full-width slides without a peek, as before: pages touch", async () => {
		await render(
			<Carousel index={0} onChange={jest.fn()} testID="carousel">
				{slides()}
			</Carousel>,
		);
		await layOut();
		const pager = screen.getByTestId("carousel-pager");
		expect(pager).toHaveProp("pagingEnabled", true);
		expect(pager).not.toHaveProp("snapToInterval");
		expect(pager).toHaveProp("contentContainerStyle", undefined);
	});

	it("keeps full-width slides a gap apart when asked, settling one per page", async () => {
		const onChange = jest.fn();
		await render(
			<Carousel index={0} onChange={onChange} gap={GAP} testID="carousel">
				{slides()}
			</Carousel>,
		);
		await layOut();

		const pager = screen.getByTestId("carousel-pager");
		expect(pager).toHaveProp("snapToInterval", PAGE_WIDTH + GAP);
		expect(pager).toHaveProp("contentContainerStyle", { gap: GAP });
		expect(pager).not.toHaveProp("pagingEnabled");
		await fireEvent(pager, "momentumScrollEnd", { nativeEvent: { contentOffset: { x: SECOND_SLIDE * (PAGE_WIDTH + GAP), y: 0 } } });
		expect(onChange).toHaveBeenCalledWith(SECOND_SLIDE);
	});
});

describe("carouselSlideMetrics", () => {
	it("is the whole width per slide without a peek, stepping a page plus any gap", () => {
		expect(carouselSlideMetrics(PAGE_WIDTH, 0, 0)).toEqual({ slideWidth: PAGE_WIDTH, interval: PAGE_WIDTH });
		expect(carouselSlideMetrics(PAGE_WIDTH, 0, GAP)).toEqual({ slideWidth: PAGE_WIDTH, interval: PAGE_WIDTH + GAP });
	});

	it("leaves room for the peek and the gap, and steps a slide plus a gap", () => {
		expect(carouselSlideMetrics(PAGE_WIDTH, PEEK, DEFAULT_CAROUSEL_GAP)).toEqual({ slideWidth: PAGE_WIDTH - PEEK - DEFAULT_CAROUSEL_GAP, interval: PAGE_WIDTH - PEEK });
	});

	it("never goes below zero before the carousel is measured", () => {
		expect(carouselSlideMetrics(0, PEEK, GAP).slideWidth).toBe(0);
	});
});

describe("carouselGapOf", () => {
	it("takes the caller's gap, else the default between peeking slides, else none", () => {
		expect(carouselGapOf(0, GAP)).toBe(GAP);
		expect(carouselGapOf(PEEK, undefined)).toBe(DEFAULT_CAROUSEL_GAP);
		expect(carouselGapOf(0, undefined)).toBe(0);
	});
});

describe("nextCarouselIndex", () => {
	it("moves on one slide, back to the first after the last", () => {
		expect(nextCarouselIndex(0, SLIDE_TITLES.length)).toBe(SECOND_SLIDE);
		expect(nextCarouselIndex(THIRD_SLIDE, SLIDE_TITLES.length)).toBe(0);
	});
});

describe("Carousel auto-play", () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});
	afterEach(() => {
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	it("moves on every interval and wraps to the first slide", async () => {
		await render(<OwnedCarousel autoPlayIntervalMs={AUTO_PLAY_MS} />);

		await wait(AUTO_PLAY_MS);
		expect(screen.getByText("Showing 1")).toBeOnTheScreen();
		await wait(AUTO_PLAY_MS);
		expect(screen.getByText("Showing 2")).toBeOnTheScreen();
		await wait(AUTO_PLAY_MS);
		expect(screen.getByText("Showing 0")).toBeOnTheScreen();
	});

	it("never moves on its own without an interval", async () => {
		await render(<OwnedCarousel />);

		await wait(LONG_WAIT_MS);

		expect(screen.getByText("Showing 0")).toBeOnTheScreen();
	});

	it("stops for good once the person swipes", async () => {
		await render(<OwnedCarousel autoPlayIntervalMs={AUTO_PLAY_MS} />);

		await fireEvent(screen.getByTestId("carousel-pager"), "scrollBeginDrag");
		await wait(LONG_WAIT_MS);

		expect(screen.getByText("Showing 0")).toBeOnTheScreen();
	});

	it("stops for good once the person picks a slide", async () => {
		await render(<OwnedCarousel autoPlayIntervalMs={AUTO_PLAY_MS} />);

		await fireEvent.press(screen.getByRole("button", { name: "Slide 3 of 3" }));
		await wait(LONG_WAIT_MS);

		expect(screen.getByText("Showing 2")).toBeOnTheScreen();
	});

	it("stays still with Reduce Motion on", async () => {
		jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
		await render(<OwnedCarousel autoPlayIntervalMs={AUTO_PLAY_MS} />);

		await wait(LONG_WAIT_MS);

		expect(screen.getByText("Showing 0")).toBeOnTheScreen();
	});
});
