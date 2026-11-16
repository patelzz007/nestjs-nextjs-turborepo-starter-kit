import { AspectRatio } from "@workspace/ui-native/components/aspect-ratio";
import { Carousel } from "@workspace/ui-native/components/carousel";
import * as React from "react";
import { Text, View } from "react-native";

import { CardScrim } from "../card/card-sample";
import { carouselSampleSlides, SlidePhoto } from "./carousel-sample";

const SLIDES = carouselSampleSlides(5);
const CAPTIONS: readonly { readonly title: string; readonly caption: string }[] = [
	{ title: "Workspace", caption: "Where the team ships from" },
	{ title: "Code", caption: "Reviewed before it merges" },
	{ title: "Network", caption: "Served from every region" },
	{ title: "People", caption: "The ones who answer the phone" },
	{ title: "Detail", caption: "Small things, done carefully" },
];

// Wide 16:9 slides with a title and caption on a dark fade at the bottom.
export function Carousel8Example(): React.JSX.Element {
	const [index, setIndex] = React.useState(0);
	return (
		<Carousel index={index} onChange={setIndex} showControls>
			{SLIDES.map((slide, position: number): React.JSX.Element => {
				const text = CAPTIONS.at(position);
				return (
					<AspectRatio key={slide.id} ratio={16 / 9} className="overflow-hidden rounded-xl bg-muted">
						<SlidePhoto slide={slide} width={800} height={450} />
						<CardScrim edge="bottom" className="absolute inset-x-0 bottom-0 h-2/3" />
						<View className="absolute inset-x-0 bottom-0 gap-0.5 p-4">
							<Text className="text-body-lg font-sans-semibold text-white">{text?.title}</Text>
							<Text className="text-caption font-sans text-white/80">{text?.caption}</Text>
						</View>
					</AspectRatio>
				);
			})}
		</Carousel>
	);
}
