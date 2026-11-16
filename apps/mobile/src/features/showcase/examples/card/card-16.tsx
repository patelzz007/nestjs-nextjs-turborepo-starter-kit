import { Avatar } from "@workspace/ui-native/components/avatar";
import { Badge } from "@workspace/ui-native/components/badge";
import { Button } from "@workspace/ui-native/components/button";
import { Card } from "@workspace/ui-native/components/card";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import CheckIcon from "lucide-react-native/icons/check";
import EllipsisVerticalIcon from "lucide-react-native/icons/ellipsis-vertical";
import * as React from "react";
import { Text, View } from "react-native";

import { ignorePress } from "../example-support";
import { SAMPLE_PORTRAITS } from "./card-sample";

const ACTIONS: readonly DropdownMenuItemData<string>[] = [
	{ value: "edit", label: "Edit" },
	{ value: "copy", label: "Copy link" },
];

interface Member {
	readonly name: string;
	readonly imageUrl: string;
}

const MEMBERS: readonly Member[] = [
	{ name: "Sofia Chen", imageUrl: SAMPLE_PORTRAITS.sofia },
	{ name: "Marco Rossi", imageUrl: SAMPLE_PORTRAITS.marco },
	{ name: "Emma Wilson", imageUrl: SAMPLE_PORTRAITS.emma },
];
const MORE_MEMBERS = 3;

export function Card16Example(): React.JSX.Element {
	return (
		<Card className="gap-0 p-0">
			<View className="flex-row items-center justify-between border-b border-border px-3 py-2">
				<Badge label="Live" variant="soft" icon={CheckIcon} />
				<DropdownMenu label="More options" icon={EllipsisVerticalIcon} size="icon" variant="ghost" items={ACTIONS} onSelect={ignorePress} />
			</View>
			<View className="gap-3 p-4">
				<View className="flex-row items-start justify-between gap-2">
					<Text className="text-label font-sans-medium text-foreground">Integration name</Text>
					<Badge label="Installed" tone="success" variant="light" size="sm" />
				</View>
				<Text className="text-label font-sans text-muted-foreground">Short description of the integration and what it does in one line.</Text>
				<View
					className="flex-row items-center"
					accessible
					accessibilityLabel={`Used by ${MEMBERS.map((member: Member): string => member.name).join(", ")} and ${String(MORE_MEMBERS)} more`}>
					{MEMBERS.map((member: Member, position: number): React.JSX.Element => (
						<Avatar
							key={member.name}
							name={member.name}
							imageUrl={member.imageUrl}
							size="sm"
							className={position === 0 ? "border-2 border-card" : "-ml-2 border-2 border-card"}
						/>
					))}
					<View className="-ml-2 size-6 items-center justify-center rounded-full border-2 border-card bg-muted">
						<Text className="text-overline font-sans-medium text-muted-foreground">{`+${String(MORE_MEMBERS)}`}</Text>
					</View>
				</View>
			</View>
			<View className="border-t border-border p-3">
				<Button label="Open" variant="outline" onPress={ignorePress} />
			</View>
		</Card>
	);
}
