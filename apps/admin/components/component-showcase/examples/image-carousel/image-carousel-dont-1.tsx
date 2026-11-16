import * as React from "react";
import { Carousel, CarouselContent, CarouselItem } from "@workspace/ui/components/carousel";
import { CoverImage } from "@workspace/ui/components/cover-image";

function photo(id: string): string {
	return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=80`;
}

const PHOTOS: readonly (readonly [string, string])[] = [
	["photo-1486312338219-ce68d2c6f44d", "A laptop on a desk"],
	["photo-1461749280684-dccba630e2f6", "Code on a screen"],
	["photo-1451187580459-43490279c0fa", "The earth at night"],
];

export function ImageCarouselDont1Example(): React.JSX.Element {
	return (
		<Carousel className="w-full max-w-sm">
			<CarouselContent>
				{PHOTOS.map(([id, alt]: readonly [string, string]): React.JSX.Element => (
					<CarouselItem key={id}>
						<CoverImage src={photo(id)} alt={alt} className="rounded-lg" />
					</CarouselItem>
				))}
			</CarouselContent>
		</Carousel>
	);
}
