import { Avatar } from "@workspace/ui-native/components/avatar";
import { Badge } from "@workspace/ui-native/components/badge";
import { Button } from "@workspace/ui-native/components/button";
import { Icon } from "@workspace/ui-native/components/icon";
import { Item, ItemActions, ItemContent, ItemDescription, ItemFooter, ItemHeader, ItemTitle } from "@workspace/ui-native/components/item";
import { Progress } from "@workspace/ui-native/components/progress";
import FolderIcon from "lucide-react-native/icons/folder";
import * as React from "react";
import { Text, View } from "react-native";

import { ignorePress } from "../example-support";
import { ALEX, EMILY, SARAH, type SamplePerson } from "./item-sample";

const TITLE = "Website Redesign";
const DESCRIPTION = "Complete overhaul of the marketing site with a focus on conversion optimization and modern design patterns.";
const TEAM: readonly SamplePerson[] = [SARAH, ALEX, EMILY];
const DONE_PERCENT = 65;

export function Item10Example(): React.JSX.Element {
	return (
		<Item variant="outline">
			<ItemHeader>
				<View className="flex-row items-center gap-2">
					<Icon icon={FolderIcon} size="xs" colorClassName="accent-muted-foreground" />
					<Text className="text-caption font-sans text-muted-foreground">Project</Text>
				</View>
				<Badge label="In Progress" tone="info" variant="light" size="sm" />
			</ItemHeader>
			<ItemContent>
				<ItemTitle>{TITLE}</ItemTitle>
				<ItemDescription>{DESCRIPTION}</ItemDescription>
			</ItemContent>
			<ItemActions>
				<Button label="Open" variant="outline" size="sm" onPress={ignorePress} />
			</ItemActions>
			<ItemFooter>
				<View className="flex-row" accessible accessibilityLabel={`Team: ${TEAM.map((person: SamplePerson): string => person.name).join(", ")}`}>
					{TEAM.map((person: SamplePerson, position: number): React.JSX.Element => (
						<Avatar
							key={person.name}
							name={person.name}
							imageUrl={person.imageUrl}
							size="sm"
							className={position === 0 ? "border-2 border-background" : "-ml-2 border-2 border-background"}
						/>
					))}
				</View>
				<View className="flex-row items-center gap-2">
					<Progress value={DONE_PERCENT} accessibilityLabel="Project progress" className="w-20" />
					<Text className="text-caption font-sans text-muted-foreground">{`${String(DONE_PERCENT)}%`}</Text>
				</View>
			</ItemFooter>
		</Item>
	);
}
