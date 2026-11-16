import { Badge } from "@workspace/ui-native/components/badge";
import { Button } from "@workspace/ui-native/components/button";
import { Icon, type LucideIcon } from "@workspace/ui-native/components/icon";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@workspace/ui-native/components/item";
import CodeIcon from "lucide-react-native/icons/code";
import DatabaseIcon from "lucide-react-native/icons/database";
import WebhookIcon from "lucide-react-native/icons/webhook";
import * as React from "react";

import { ignorePress } from "../example-support";

interface Source {
	readonly icon: LucideIcon;
	readonly title: string;
	readonly description: string;
	readonly connected: boolean;
}

const SOURCES: readonly Source[] = [
	{ icon: DatabaseIcon, title: "Database", description: "Sync records from your data warehouse", connected: true },
	{ icon: WebhookIcon, title: "Webhooks", description: "Push realtime events to your endpoints", connected: true },
	{ icon: CodeIcon, title: "API access", description: "Build custom integrations with the REST API", connected: false },
];

export function Item11Example(): React.JSX.Element {
	return (
		<ItemGroup size="xs">
			{SOURCES.map((source: Source): React.JSX.Element => (
				<Item key={source.title} variant="outline" size="xs">
					<ItemMedia variant="icon">
						<Icon icon={source.icon} size="sm" colorClassName="accent-foreground" />
					</ItemMedia>
					<ItemContent>
						<ItemTitle>{source.title}</ItemTitle>
						<ItemDescription>{source.description}</ItemDescription>
					</ItemContent>
					<ItemActions>
						{source.connected ? (
							<Badge label="Connected" tone="success" variant="light" size="sm" />
						) : (
							<Button label="Connect" variant="outline" size="sm" onPress={ignorePress} />
						)}
					</ItemActions>
				</Item>
			))}
		</ItemGroup>
	);
}
