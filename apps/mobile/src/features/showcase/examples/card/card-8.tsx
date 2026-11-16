import { Card } from "@workspace/ui-native/components/card";
import { Image } from "expo-image";
import * as React from "react";
import { Text, View } from "react-native";

import { CARD_PHOTOS, CardScrim } from "./card-sample";

// A full-bleed photo with its title on a dark fade at the bottom. (The web zooms the photo on hover; a phone has no hover.)
export function Card8Example(): React.JSX.Element {
	return (
		<Card className="h-96 overflow-hidden border-0 p-0">
			<Image source={CARD_PHOTOS.waves} accessibilityLabel="Abstract sample photo" contentFit="cover" className="absolute inset-0" />
			<CardScrim edge="bottom" className="absolute inset-x-0 bottom-0 h-1/2" />
			<View className="flex-1 justify-end p-6">
				<Text className="text-title font-sans-bold text-status-foreground">Image Scale Effect</Text>
				<Text className="text-label mt-2 font-sans text-status-foreground/90">This card features a full bleed photo with a readable caption laid over a dark fade.</Text>
			</View>
		</Card>
	);
}
