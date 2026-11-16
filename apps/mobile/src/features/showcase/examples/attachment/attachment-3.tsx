import { Attachment } from "@workspace/ui-native/components/attachment";
import * as React from "react";
import { ScrollView, Text, View } from "react-native";

import { SAMPLE_IMAGES } from "./attachment-sample";

interface Shot {
	readonly name: string;
	readonly uri: string;
	readonly size: string;
}

const SHOTS: readonly Shot[] = [
	{ name: "brand-gradient.png", uri: SAMPLE_IMAGES.gradient, size: "1600 × 900" },
	{ name: "wave-pattern.png", uri: SAMPLE_IMAGES.waves, size: "1200 × 1200" },
	{ name: "spectrum-wash.jpg", uri: SAMPLE_IMAGES.fluid, size: "2048 × 1365" },
	{ name: "mesh-backdrop.png", uri: SAMPLE_IMAGES.prism, size: "1920 × 1080" },
];

// Image cards in a snapping strip: a press marks one as chosen and prints its name and size below.
export function Attachment3Example(): React.JSX.Element {
	const [chosen, setChosen] = React.useState(SHOTS.at(0)?.name ?? "");
	const shot = SHOTS.find((candidate: Shot): boolean => candidate.name === chosen);
	return (
		<View className="w-full gap-2">
			<ScrollView horizontal snapToInterval={124} decelerationRate="fast" showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3">
				{SHOTS.map((item: Shot): React.JSX.Element => (
					<ShotCard key={item.name} shot={item} chosen={item.name === chosen} onChoose={setChosen} />
				))}
			</ScrollView>
			<Text accessibilityLiveRegion="polite" className="text-label font-sans text-muted-foreground">
				{shot === undefined ? "" : `${shot.name} · ${shot.size}`}
			</Text>
		</View>
	);
}

function ShotCard({ shot, chosen, onChoose }: { readonly shot: Shot; readonly chosen: boolean; readonly onChoose: (name: string) => void }): React.JSX.Element {
	const choose = React.useCallback((): void => {
		onChoose(shot.name);
	}, [onChoose, shot.name]);
	return <Attachment name={shot.name} imageUri={shot.uri} orientation="vertical" size="sm" pressed={chosen} onPress={choose} />;
}
