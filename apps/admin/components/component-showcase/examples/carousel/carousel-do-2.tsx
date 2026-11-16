import * as React from "react";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@workspace/ui/components/carousel";

const SLIDES: readonly string[] = ["Spring collection", "Summer sale", "Gift cards", "New arrivals"];

export function CarouselDo2Example(): React.JSX.Element {
	return (
		<Carousel className="w-full max-w-xs">
			<CarouselContent>
				{SLIDES.map((slide: string): React.JSX.Element => (
					<CarouselItem key={slide} className="basis-4/5">
						<div className="flex aspect-video items-center justify-center rounded-lg border bg-muted text-sm font-medium">{slide}</div>
					</CarouselItem>
				))}
			</CarouselContent>
			<CarouselPrevious />
			<CarouselNext />
		</Carousel>
	);
}
