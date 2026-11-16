"use client";

import * as React from "react";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@workspace/ui/components/carousel";

const SLIDES: readonly string[] = ["Spring collection", "Summer sale", "Gift cards", "New arrivals"];

/** A new slide every 1.5 seconds, whatever the reader is doing. */
const ROTATE_MS = 1_500;
const LOOP = { loop: true };

export function CarouselDont2Example(): React.JSX.Element {
	const [api, setApi] = React.useState<CarouselApi>();
	React.useEffect((): (() => void) | undefined => {
		if (api === undefined) {
			return undefined;
		}
		const timer = window.setInterval((): void => {
			api.scrollNext();
		}, ROTATE_MS);
		return (): void => {
			window.clearInterval(timer);
		};
	}, [api]);
	return (
		<Carousel setApi={setApi} opts={LOOP} className="w-full max-w-xs">
			<CarouselContent>
				{SLIDES.map((slide: string): React.JSX.Element => (
					<CarouselItem key={slide}>
						<div className="flex aspect-video items-center justify-center rounded-lg border bg-muted text-sm font-medium">{slide}</div>
					</CarouselItem>
				))}
			</CarouselContent>
		</Carousel>
	);
}
