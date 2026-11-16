import * as React from "react";
import { BellIcon, MailIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@workspace/ui/components/item";

export function Item2Example(): React.JSX.Element {
	return (
		<div className="mx-auto flex w-full max-w-md flex-col gap-2">
			<Item variant="outline">
				<ItemMedia variant="icon">
					<MailIcon />
				</ItemMedia>
				<ItemContent>
					<ItemTitle>Email Notifications</ItemTitle>
					<ItemDescription>Receive updates via email</ItemDescription>
				</ItemContent>
				<ItemActions>
					<Button variant="outline" size="sm">
						Configure
					</Button>
				</ItemActions>
			</Item>
			<Item variant="outline">
				<ItemMedia variant="icon">
					<BellIcon />
				</ItemMedia>
				<ItemContent>
					<ItemTitle>Push Notifications</ItemTitle>
					<ItemDescription>Get notified on your device</ItemDescription>
				</ItemContent>
				<ItemActions>
					<Button size="sm">Enable</Button>
				</ItemActions>
			</Item>
		</div>
	);
}
