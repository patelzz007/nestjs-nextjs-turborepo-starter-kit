import { Badge } from "@workspace/ui-native/components/badge";
import { Button } from "@workspace/ui-native/components/button";
import { Card, CardContent } from "@workspace/ui-native/components/card";
import { Icon } from "@workspace/ui-native/components/icon";
import { Image } from "expo-image";
import ArrowRightIcon from "lucide-react-native/icons/arrow-right";
import BellIcon from "lucide-react-native/icons/bell";
import SparklesIcon from "lucide-react-native/icons/sparkles";
import * as React from "react";
import { Text, View } from "react-native";

import { ignorePress } from "../example-support";
import { CARD_PHOTOS } from "./card-sample";

export function Card7Example(): React.JSX.Element {
	return (
		<Card>
			<CardContent className="gap-4">
				<Image source={CARD_PHOTOS.gradient} accessibilityLabel="Abstract sample photo" contentFit="cover" className="h-48 w-full rounded-lg" />
				<View className="flex-row items-center justify-between gap-5">
					<Badge label="Trending" variant="outline" icon={BellIcon} />
					<View className="flex-row items-center gap-1">
						<Icon icon={SparklesIcon} size="xs" colorClassName="accent-secondary-foreground" />
						<Text className="text-caption font-sans-medium text-secondary-foreground">Featured</Text>
					</View>
				</View>
				<Text className="text-label font-sans text-foreground">Simplifying your workflow from day one. Manage your tasks, projects, and team in one place.</Text>
				<Button label="Get Started" icon={ArrowRightIcon} iconPosition="end" onPress={ignorePress} />
			</CardContent>
		</Card>
	);
}
