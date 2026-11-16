import * as React from "react";
import { CodeIcon, DatabaseIcon, WebhookIcon } from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";

import { Button } from "@workspace/ui/components/button";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@workspace/ui/components/item";

export function Item11Example(): React.JSX.Element {
	return (
		<div className="mx-auto flex w-full max-w-md flex-col">
			<ItemGroup>
				<Item variant="outline" size="xs">
					<ItemMedia variant="icon">
						<DatabaseIcon />
					</ItemMedia>
					<ItemContent>
						<ItemTitle>Database</ItemTitle>
						<ItemDescription>Sync records from your data warehouse</ItemDescription>
					</ItemContent>
					<ItemActions>
						<Badge variant="success-light" size="sm">
							Connected
						</Badge>
					</ItemActions>
				</Item>
				<Item variant="outline" size="xs">
					<ItemMedia variant="icon">
						<WebhookIcon />
					</ItemMedia>
					<ItemContent>
						<ItemTitle>Webhooks</ItemTitle>
						<ItemDescription>Push realtime events to your endpoints</ItemDescription>
					</ItemContent>
					<ItemActions>
						<Badge variant="success-light" size="sm">
							Connected
						</Badge>
					</ItemActions>
				</Item>
				<Item variant="outline" size="xs">
					<ItemMedia variant="icon">
						<CodeIcon />
					</ItemMedia>
					<ItemContent>
						<ItemTitle>API access</ItemTitle>
						<ItemDescription>Build custom integrations with the REST API</ItemDescription>
					</ItemContent>
					<ItemActions>
						<Button variant="outline" size="sm">
							Connect
						</Button>
					</ItemActions>
				</Item>
			</ItemGroup>
		</div>
	);
}
