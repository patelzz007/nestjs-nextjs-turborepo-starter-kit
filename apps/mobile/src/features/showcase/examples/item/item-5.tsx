import { Avatar } from "@workspace/ui-native/components/avatar";
import { Badge, type BadgeTone, type BadgeVariant } from "@workspace/ui-native/components/badge";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@workspace/ui-native/components/item";
import * as React from "react";

import { ALEX, DAVID, SARAH, type SamplePerson } from "./item-sample";

interface Presence {
	readonly person: SamplePerson;
	readonly role: string;
	readonly status: string;
	readonly tone: BadgeTone;
	readonly variant: BadgeVariant;
}

const TEAM: readonly Presence[] = [
	{ person: SARAH, role: "Team Lead", status: "Online", tone: "success", variant: "solid" },
	{ person: ALEX, role: "Developer", status: "Away", tone: "warning", variant: "solid" },
	{ person: DAVID, role: "Designer", status: "Offline", tone: "neutral", variant: "outline" },
];

export function Item5Example(): React.JSX.Element {
	return (
		<ItemGroup size="xs">
			{TEAM.map((member: Presence): React.JSX.Element => (
				<Item key={member.person.name} variant="outline" size="xs">
					<ItemMedia>
						<Avatar name={member.person.name} imageUrl={member.person.imageUrl} size="md" />
					</ItemMedia>
					<ItemContent>
						<ItemTitle>{member.person.name}</ItemTitle>
						<ItemDescription>{member.role}</ItemDescription>
					</ItemContent>
					<ItemActions>
						<Badge label={member.status} tone={member.tone} variant={member.variant} size="sm" />
					</ItemActions>
				</Item>
			))}
		</ItemGroup>
	);
}
