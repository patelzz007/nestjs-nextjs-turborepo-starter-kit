import { Avatar } from "@workspace/ui-native/components/avatar";
import { Badge } from "@workspace/ui-native/components/badge";
import { Card } from "@workspace/ui-native/components/card";
import { Icon } from "@workspace/ui-native/components/icon";
import { TextLink } from "@workspace/ui-native/components/text-link";
import { Image } from "expo-image";
import BadgeCheckIcon from "lucide-react-native/icons/badge-check";
import * as React from "react";
import { Text, View } from "react-native";

import { ignorePress } from "../example-support";
import { CARD_PHOTOS, CardScrim, SAMPLE_PORTRAITS } from "./card-sample";

// A tall photo with dark fades at both edges: the author row on top, the title and blurb at the bottom.
export function Card10Example(): React.JSX.Element {
	return (
		<Card className="h-96 overflow-hidden p-0">
			<Image source={CARD_PHOTOS.prism} accessibilityLabel="Abstract sample photo" contentFit="cover" className="absolute inset-0" />
			<CardScrim edge="top" className="absolute inset-x-0 top-0 h-1/2" />
			<CardScrim edge="bottom" className="absolute inset-x-0 bottom-0 h-1/2" />
			<View className="absolute inset-x-0 top-0 flex-row items-center gap-3 p-6">
				<View>
					<Avatar name="Nick Johnson" imageUrl={SAMPLE_PORTRAITS.james} size="md" />
					<View className="absolute -top-0.5 -right-0.5 rounded-full bg-background">
						<Icon icon={BadgeCheckIcon} size="xs" colorClassName="accent-primary" />
					</View>
				</View>
				<View className="flex-1 gap-px">
					<TextLink label="Nick Johnson" onPress={ignorePress} className="justify-start" />
					<Text className="text-caption font-sans text-status-foreground/80">nick@example.com</Text>
				</View>
				<Badge label="New" tone="success" variant="solid" />
			</View>
			<View className="absolute inset-x-0 bottom-0 gap-2 p-6">
				<Text className="text-h3 font-sans-semibold text-status-foreground">Author Profile</Text>
				<Text className="text-label font-sans text-status-foreground">Profile card showcasing the author’s avatar, name, and estimated reading time for each post.</Text>
			</View>
		</Card>
	);
}
