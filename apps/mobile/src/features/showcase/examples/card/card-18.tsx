import { Card } from "@workspace/ui-native/components/card";
import { Icon } from "@workspace/ui-native/components/icon";
import { TextLink } from "@workspace/ui-native/components/text-link";
import BookOpenIcon from "lucide-react-native/icons/book-open";
import * as React from "react";
import { Text, View } from "react-native";

import { ignorePress } from "../example-support";

export function Card18Example(): React.JSX.Element {
	return (
		<Card className="gap-0 p-0">
			<View className="flex-row items-center gap-2 border-b border-border px-4 py-3">
				<Icon icon={BookOpenIcon} size="sm" colorClassName="accent-muted-foreground" />
				<Text className="text-label font-sans-medium text-foreground">Documentation</Text>
			</View>
			<View className="gap-3 p-4">
				<Text className="text-label font-sans text-muted-foreground">Find guides, API references, and examples to integrate with our platform.</Text>
				<TextLink label="View docs" size="sm" onPress={ignorePress} className="justify-start" />
			</View>
		</Card>
	);
}
