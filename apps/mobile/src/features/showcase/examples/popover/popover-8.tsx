import { Button } from "@workspace/ui-native/components/button";
import { AspectRatio } from "@workspace/ui-native/components/aspect-ratio";
import { Popover } from "@workspace/ui-native/components/popover";
import { Image } from "expo-image";
import * as React from "react";
import { Text, View } from "react-native";

import { ignorePress } from "../example-support";

const PREVIEW = "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=640&h=360&fit=crop";

const CONTENT = (
	<View className="gap-3">
		<View className="-mx-4 -mt-4 overflow-hidden rounded-t-2xl">
			<AspectRatio ratio={16 / 9}>
				<Image source={PREVIEW} accessibilityLabel="A bright living room" contentFit="cover" className="size-full" />
			</AspectRatio>
		</View>
		<Text className="text-body-lg font-sans-semibold text-foreground">Modern living</Text>
		<Text className="text-body font-sans text-muted-foreground">A clean template for interior studios.</Text>
		<View className="flex-row gap-2">
			<Button label="Use template" size="sm" onPress={ignorePress} />
			<Button label="Preview" variant="outline" size="sm" onPress={ignorePress} />
		</View>
	</View>
);

export function Popover8Example(): React.JSX.Element {
	return (
		<Popover content={CONTENT} accessibilityLabel="Modern living template" size="lg">
			<Button label="Template preview" variant="outline" onPress={ignorePress} />
		</Popover>
	);
}
