// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { UI_KIT_LABELS_EN } from "../lib/labels/en";
import type { UiKitLabels, UiKitLabelsOverride } from "../lib/labels/ui-kit-labels";
import { UiKitTestProviders } from "../testing/ui-kit-test-providers";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "./carousel";
import { UiKitLabelsProvider } from "./ui-kit-labels-provider";

/** Embla observes the viewport's size and its slides' visibility — jsdom implements neither. */
class NoopObserver {
	public observe(): void {
		return undefined;
	}
	public unobserve(): void {
		return undefined;
	}
	public disconnect(): void {
		return undefined;
	}
}

beforeAll((): void => {
	vi.stubGlobal("ResizeObserver", NoopObserver);
	vi.stubGlobal("IntersectionObserver", NoopObserver);
	window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() });
});

afterEach((): void => {
	cleanup();
});

/** A per-usage override of two strings — the rest must still come from the `carousel` family. */
const FRENCH_LABELS: UiKitLabelsOverride<"carousel"> = {
	carouselRoleDescription: "carrousel",
	previousSlide: "Diapositive précédente",
};

/** A label set whose `carousel` family differs from English — proves the provider supplies the copy. */
const GERMAN_LABELS: UiKitLabels = {
	...UI_KIT_LABELS_EN,
	carousel: { carouselRoleDescription: "Karussell", slideRoleDescription: "Folie", previousSlide: "Vorherige Folie", nextSlide: "Nächste Folie" },
};

function OneSlideCarousel(): React.JSX.Element {
	return (
		<Carousel>
			<CarouselContent>
				<CarouselItem>Eins</CarouselItem>
			</CarouselContent>
			<CarouselPrevious />
			<CarouselNext />
		</Carousel>
	);
}

describe("Carousel", () => {
	it("describes itself and its arrows from the carousel family", (): void => {
		render(
			<Carousel>
				<CarouselContent>
					<CarouselItem>One</CarouselItem>
				</CarouselContent>
				<CarouselPrevious />
				<CarouselNext />
			</Carousel>,
			{ wrapper: UiKitTestProviders },
		);

		expect(screen.getByRole("region").getAttribute("aria-roledescription")).toBe(UI_KIT_LABELS_EN.carousel.carouselRoleDescription);
		expect(screen.getByRole("group").getAttribute("aria-roledescription")).toBe(UI_KIT_LABELS_EN.carousel.slideRoleDescription);
		expect(screen.getByRole("button", { name: UI_KIT_LABELS_EN.carousel.previousSlide })).toBeTruthy();
		expect(screen.getByRole("button", { name: UI_KIT_LABELS_EN.carousel.nextSlide })).toBeTruthy();
	});

	it("lays a partial labels prop over the family, and a per-arrow label wins", (): void => {
		render(
			<Carousel labels={FRENCH_LABELS}>
				<CarouselContent>
					<CarouselItem>Un</CarouselItem>
				</CarouselContent>
				<CarouselPrevious />
				<CarouselNext label="Suivant" />
			</Carousel>,
			{ wrapper: UiKitTestProviders },
		);

		expect(screen.getByRole("region").getAttribute("aria-roledescription")).toBe("carrousel");
		expect(screen.getByRole("button", { name: "Diapositive précédente" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Suivant" })).toBeTruthy();
		// The string the override leaves out still comes from the family.
		expect(screen.getByRole("group").getAttribute("aria-roledescription")).toBe(UI_KIT_LABELS_EN.carousel.slideRoleDescription);
	});

	it("forwards refs on every part", (): void => {
		const rootRef = React.createRef<HTMLDivElement>();
		const trackRef = React.createRef<HTMLDivElement>();
		const itemRef = React.createRef<HTMLDivElement>();
		const previousRef = React.createRef<HTMLElement>();
		const nextRef = React.createRef<HTMLElement>();
		render(
			<Carousel ref={rootRef}>
				<CarouselContent ref={trackRef}>
					<CarouselItem ref={itemRef}>One</CarouselItem>
				</CarouselContent>
				<CarouselPrevious ref={previousRef} />
				<CarouselNext ref={nextRef} />
			</Carousel>,
			{ wrapper: UiKitTestProviders },
		);

		expect(rootRef.current?.dataset.slot).toBe("carousel");
		expect(trackRef.current?.parentElement?.dataset.slot).toBe("carousel-content");
		expect(itemRef.current?.dataset.slot).toBe("carousel-item");
		expect(previousRef.current?.dataset.slot).toBe("carousel-previous");
		expect(nextRef.current?.dataset.slot).toBe("carousel-next");
	});

	it("reads the carousel family from the nearest UiKitLabelsProvider", (): void => {
		render(
			<UiKitLabelsProvider labels={GERMAN_LABELS}>
				<OneSlideCarousel />
			</UiKitLabelsProvider>,
		);

		expect(screen.getByRole("region").getAttribute("aria-roledescription")).toBe(GERMAN_LABELS.carousel.carouselRoleDescription);
		expect(screen.getByRole("group").getAttribute("aria-roledescription")).toBe(GERMAN_LABELS.carousel.slideRoleDescription);
		expect(screen.getByRole("button", { name: GERMAN_LABELS.carousel.nextSlide })).toBeTruthy();
	});

	it("throws without a UiKitLabelsProvider", (): void => {
		expect(() => render(<OneSlideCarousel />)).toThrow('"carousel" labels');
	});
});
