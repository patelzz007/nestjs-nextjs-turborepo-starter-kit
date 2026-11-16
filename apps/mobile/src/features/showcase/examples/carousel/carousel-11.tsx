import { AspectRatio } from "@workspace/ui-native/components/aspect-ratio";
import { Carousel } from "@workspace/ui-native/components/carousel";
import * as React from "react";
import { Text, View } from "react-native";

import { CardScrim } from "../card/card-sample";
import { carouselSampleSlides, SlidePhoto } from "./carousel-sample";

const SLIDES = carouselSampleSlides(5);
const CAPTIONS: readonly string[] = ["Plan the week", "Ship on Thursday", "Measure on Friday", "Rest on the weekend", "Repeat"];

// Square captioned slides with a row of dots under them, the shown dot stretched wider.
export function Carousel11Example(): React.JSX.Element {
	const [index, setIndex] = React.useState(0);
	return (
		<Carousel index={index} onChange={setIndex}>
			{SLIDES.map((slide, position: number): React.JSX.Element => (
				<AspectRatio key={slide.id} ratio={1} className="overflow-hidden rounded-xl bg-muted">
					<SlidePhoto slide={slide} width={600} height={600} />
					<CardScrim edge="bottom" className="absolute inset-x-0 bottom-0 h-1/2" />
					<View className="absolute inset-x-0 bottom-0 p-4">
						<Text className="text-body-lg font-sans-semibold text-white">{CAPTIONS.at(position)}</Text>
					</View>
				</AspectRatio>
			))}
		</Carousel>
	);
}
