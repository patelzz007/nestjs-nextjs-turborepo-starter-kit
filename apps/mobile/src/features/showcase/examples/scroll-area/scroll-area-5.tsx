import { ScrollArea } from "@workspace/ui-native/components/scroll-area";
import { Image } from "expo-image";
import * as React from "react";

const PHOTOS: readonly { readonly id: string; readonly by: string; readonly uri: string }[] = Array.from({ length: 10 }, (_photo: undefined, index: number) => ({
	id: `photo-${String(index)}`,
	by: ["Ornella Binni", "Tom Byrom", "Vladimir Malyavko", "Anna Auza", "Joel Filipe"].at(index % 5) ?? "",
	uri: `https://picsum.photos/seed/showcase-${String(index)}/300/400`,
}));

export function ScrollArea5Example(): React.JSX.Element {
	return (
		<ScrollArea gutter accessibilityLabel="Photos" className="h-80" contentClassName="gap-3">
			{PHOTOS.map((photo): React.JSX.Element => (
				<Image key={photo.id} source={photo.uri} accessibilityLabel={`Photo by ${photo.by}`} contentFit="cover" className="aspect-video w-full rounded-lg" />
			))}
		</ScrollArea>
	);
}
