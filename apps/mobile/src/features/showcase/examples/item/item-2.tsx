import { Button, type ButtonVariant } from "@workspace/ui-native/components/button";
import { Icon, type LucideIcon } from "@workspace/ui-native/components/icon";
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@workspace/ui-native/components/item";
import BellIcon from "lucide-react-native/icons/bell";
import MailIcon from "lucide-react-native/icons/mail";
import * as React from "react";
import { View } from "react-native";

import { ignorePress } from "../example-support";

interface Channel {
	readonly icon: LucideIcon;
	readonly title: string;
	readonly description: string;
	readonly action: string;
	readonly actionVariant: ButtonVariant;
}

const CHANNELS: readonly Channel[] = [
	{ icon: MailIcon, title: "Email Notifications", description: "Receive updates via email", action: "Configure", actionVariant: "outline" },
	{ icon: BellIcon, title: "Push Notifications", description: "Get notified on your device", action: "Enable", actionVariant: "primary" },
];

export function Item2Example(): React.JSX.Element {
	return (
		<View className="gap-2">
			{CHANNELS.map((channel: Channel): React.JSX.Element => (
				<Item key={channel.title} variant="outline">
					<ItemMedia variant="icon">
						<Icon icon={channel.icon} size="sm" colorClassName="accent-foreground" />
					</ItemMedia>
					<ItemContent>
						<ItemTitle>{channel.title}</ItemTitle>
						<ItemDescription>{channel.description}</ItemDescription>
					</ItemContent>
					<ItemActions>
						<Button label={channel.action} variant={channel.actionVariant} size="sm" onPress={ignorePress} />
					</ItemActions>
				</Item>
			))}
		</View>
	);
}
