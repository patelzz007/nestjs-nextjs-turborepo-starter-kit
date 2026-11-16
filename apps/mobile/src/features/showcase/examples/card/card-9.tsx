import { Badge } from "@workspace/ui-native/components/badge";
import { Button } from "@workspace/ui-native/components/button";
import { Card } from "@workspace/ui-native/components/card";
import { Image } from "expo-image";
import ArrowRightIcon from "lucide-react-native/icons/arrow-right";
import BellIcon from "lucide-react-native/icons/bell";
import * as React from "react";
import { Text, View } from "react-native";

import { ignorePress } from "../example-support";
import { CARD_PHOTOS } from "./card-sample";

export function Card9Example(): React.JSX.Element {
	return (
		<Card className="gap-5 overflow-hidden p-0">
			<Image source={CARD_PHOTOS.fluid} accessibilityLabel="Abstract sample photo" contentFit="cover" className="h-48 w-full" />
			<View className="items-center gap-4 px-6 pb-6">
				<Badge label="Trending" variant="outline" icon={BellIcon} />
				<Text className="text-label text-center font-sans text-foreground">Making your design process faster and easier. Design tools for your team.</Text>
				<Button label="Get Started" icon={ArrowRightIcon} iconPosition="end" onPress={ignorePress} className="self-center" />
			</View>
		</Card>
	);
}
