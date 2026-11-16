import { CoverImage } from "@workspace/ui-native/components/cover-image";
import * as React from "react";

import { Text, View } from "react-native";

const FALLBACK = (
	<View className="size-full items-center justify-center bg-muted">
		<Text className="text-label font-sans text-muted-foreground">No cover yet</Text>
	</View>
);

export function CoverImageDo2Example(): React.JSX.Element {
	return <CoverImage uri={null} alt="No cover" fallback={FALLBACK} />;
}
