import { ScrollArea } from "@workspace/ui-native/components/scroll-area";
import { Image } from "expo-image";
import * as React from "react";
import { Text, View } from "react-native";

const PHOTOS: readonly { readonly id: string; readonly by: string; readonly uri: string }[] = Array.from({ length: 10 }, (_photo: undefined, index: number) => ({
	id: `photo-${String(index)}`,
	by: ["Ornella Binni", "Tom Byrom", "Vladimir Malyavko", "Anna Auza", "Joel Filipe"].at(index % 5) ?? "",
	uri: `https://picsum.photos/seed/showcase-${String(index)}/300/400`,
}));

export function ScrollArea2Example(): React.JSX.Element {
	return (
		<ScrollArea orientation="horizontal" variant="outline" accessibilityLabel="Photos" contentClassName="gap-3 p-3">
			{PHOTOS.map((photo): React.JSX.Element => (
				<View key={photo.id} className="w-36 gap-1">
					<Image source={photo.uri} accessibilityLabel={`Photo by ${photo.by}`} contentFit="cover" className="aspect-3/4 rounded-lg" />
					<Text className="text-caption font-sans text-muted-foreground">{`Photo by ${photo.by}`}</Text>
				</View>
			))}
		</ScrollArea>
	);
}
