import { Avatar } from "@workspace/ui-native/components/avatar";
import { Button } from "@workspace/ui-native/components/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@workspace/ui-native/components/card";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import EllipsisIcon from "lucide-react-native/icons/ellipsis";
import ExternalLinkIcon from "lucide-react-native/icons/external-link";
import SettingsIcon from "lucide-react-native/icons/settings";
import UserIcon from "lucide-react-native/icons/user";
import * as React from "react";
import { Text } from "react-native";

import { ignorePress } from "../example-support";

const TITLE = "Need a help in Claim?";

const TEAM_ACTIONS: readonly DropdownMenuItemData<string>[] = [
	{ value: "members", label: "Manage members", icon: UserIcon, group: "Team Settings" },
	{ value: "preferences", label: "Team preferences", icon: SettingsIcon, group: "Team Settings" },
	{ value: "dashboard", label: "Open dashboard", icon: ExternalLinkIcon },
];

const ACCOUNT = <Avatar name="Chris Hill" imageUrl={null} size="sm" />;

export function Card6Example(): React.JSX.Element {
	return (
		<Card className="gap-2">
			<CardHeader className="flex-row items-center justify-between">
				<CardTitle>{TITLE}</CardTitle>
				<DropdownMenu label="Team actions" icon={EllipsisIcon} size="icon" variant="ghost" items={TEAM_ACTIONS} onSelect={ignorePress} />
			</CardHeader>
			<CardContent>
				<Text className="text-label font-sans text-foreground">Go to this step by step guideline process on how to certify for your weekly benefits:</Text>
			</CardContent>
			<CardFooter>
				<Button label="@chrishill" size="sm" leading={ACCOUNT} onPress={ignorePress} />
			</CardFooter>
		</Card>
	);
}
