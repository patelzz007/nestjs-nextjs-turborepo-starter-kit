import { CoverImage } from "@workspace/ui-native/components/cover-image";
import { Icon } from "@workspace/ui-native/components/icon";
import ImageOffIcon from "lucide-react-native/icons/image-off";
import * as React from "react";
import { Text, View } from "react-native";

const COVER_URL = "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=800&q=80";

const FALLBACK = (
	<View className="size-full items-center justify-center gap-2 bg-muted">
		<Icon icon={ImageOffIcon} size="md" colorClassName="accent-muted-foreground" />
		<Text className="text-label font-sans text-muted-foreground">No image</Text>
	</View>
);

// A cover photo, and the same frame with no image falling back to a placeholder.
export function CoverImage1Example(): React.JSX.Element {
	return (
		<View className="w-full gap-4">
			<CoverImage uri={COVER_URL} alt="Code on a laptop screen" />
			<CoverImage uri={null} alt="No cover" fallback={FALLBACK} />
		</View>
	);
}
