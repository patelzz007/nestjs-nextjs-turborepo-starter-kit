import { Card, CardContent } from "@workspace/ui-native/components/card";
import { IconTile } from "@workspace/ui-native/components/icon-tile";
import { TextLink } from "@workspace/ui-native/components/text-link";
import ShoppingBagIcon from "lucide-react-native/icons/shopping-bag";
import * as React from "react";
import { Text } from "react-native";

import { ignorePress } from "../example-support";

export function Card17Example(): React.JSX.Element {
	return (
		<Card>
			<CardContent className="gap-3">
				<IconTile icon={ShoppingBagIcon} variant="solid" tone="brand" size="md" />
				<TextLink label="Recent Orders Overview" onPress={ignorePress} className="justify-start" />
				<Text className="text-caption font-sans text-muted-foreground">Track and review all recent purchases, updates, and status changes in one place.</Text>
				<TextLink label="View Orders ›" size="sm" onPress={ignorePress} className="justify-start" />
			</CardContent>
		</Card>
	);
}
