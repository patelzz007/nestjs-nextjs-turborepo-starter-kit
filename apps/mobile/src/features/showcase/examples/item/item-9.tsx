import { Avatar } from "@workspace/ui-native/components/avatar";
import { Badge, type BadgeTone, type BadgeVariant } from "@workspace/ui-native/components/badge";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@workspace/ui-native/components/item";
import EllipsisIcon from "lucide-react-native/icons/ellipsis";
import * as React from "react";

import { ignorePress } from "../example-support";
import { ALEX, EMILY, SARAH, type SamplePerson } from "./item-sample";

interface TeamMember {
	readonly person: SamplePerson;
	readonly email: string;
	readonly role: string;
	readonly tone: BadgeTone;
	readonly variant: BadgeVariant;
}

const MEMBERS: readonly TeamMember[] = [
	{ person: SARAH, email: "sarah@example.com", role: "Admin", tone: "primary", variant: "solid" },
	{ person: ALEX, email: "alex@example.com", role: "Editor", tone: "info", variant: "light" },
	{ person: EMILY, email: "emily@example.com", role: "Viewer", tone: "neutral", variant: "outline" },
];

const ACTIONS: readonly DropdownMenuItemData<string>[] = [
	{ value: "role", label: "Change Role" },
	{ value: "profile", label: "View Profile" },
	{ value: "remove", label: "Remove", variant: "destructive" },
];

export function Item9Example(): React.JSX.Element {
	return (
		<ItemGroup size="xs">
			{MEMBERS.map((member: TeamMember): React.JSX.Element => (
				<Item key={member.email} variant="outline" size="xs">
					<ItemMedia>
						<Avatar name={member.person.name} imageUrl={member.person.imageUrl} size="md" />
					</ItemMedia>
					<ItemContent>
						<ItemTitle>{member.person.name}</ItemTitle>
						<ItemDescription>{member.email}</ItemDescription>
					</ItemContent>
					<ItemActions>
						<Badge label={member.role} tone={member.tone} variant={member.variant} size="sm" />
						<DropdownMenu label={`Actions for ${member.person.name}`} icon={EllipsisIcon} size="icon" variant="ghost" items={ACTIONS} onSelect={ignorePress} />
					</ItemActions>
				</Item>
			))}
		</ItemGroup>
	);
}
