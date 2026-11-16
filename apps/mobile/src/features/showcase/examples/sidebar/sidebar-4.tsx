import LinkIcon from "lucide-react-native/icons/link";
import XIcon from "lucide-react-native/icons/x";
import { Avatar } from "@workspace/ui-native/components/avatar";
import { Badge } from "@workspace/ui-native/components/badge";
import { Button } from "@workspace/ui-native/components/button";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import { Sheet } from "@workspace/ui-native/components/sheet";
import * as React from "react";
import { Text, View } from "react-native";

import { ignorePress } from "../example-support";

const ASSIGNEES: readonly string[] = ["Ava Patel", "Ben Ortiz"];
const ACTIVITY: readonly string[] = ["Ava moved this to In progress · 2h", "Ben linked #482 · 1d", "Ava created this issue · 3d"];
const ASSIGNEES_TITLE = "Assignees";
const LINKED = "Linked work";
const ACTIVITY_TITLE = "Activity";

function Assignee({ name, owner }: { readonly name: string; readonly owner: boolean }): React.JSX.Element {
	return (
		<View className="flex-row items-center gap-2">
			<Avatar name={name} imageUrl={null} size="sm" />
			<Text className="text-body flex-1 font-sans text-foreground">{name}</Text>
			{owner ? <Badge label="Owner" size="sm" /> : null}
			<IconButton icon={XIcon} label={`Remove ${name}`} variant="ghost" size="xs" onPress={ignorePress} />
		</View>
	);
}

export function Sidebar4Example(): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const show = React.useCallback((): void => {
		setOpen(true);
	}, []);
	const footer = <Button label="Open in board" variant="outline" onPress={ignorePress} />;
	return (
		<>
			<Button label="Issue details" variant="outline" onPress={show} />
			<Sheet open={open} onOpenChange={setOpen} side="right" title="ACME-142" description="Fix login on slow networks" footer={footer}>
				<View className="gap-2">
					<Text className="text-caption font-sans-semibold text-muted-foreground uppercase">{ASSIGNEES_TITLE}</Text>
					{ASSIGNEES.map((name: string, index: number): React.JSX.Element => (
						<Assignee key={name} name={name} owner={index === 0} />
					))}
				</View>
				<View className="gap-2">
					<Text className="text-caption font-sans-semibold text-muted-foreground uppercase">{LINKED}</Text>
					<Button label="#482 Retry failed sign-ins" icon={LinkIcon} variant="ghost" size="sm" onPress={ignorePress} className="self-start" />
				</View>
				<View className="gap-1">
					<Text className="text-caption font-sans-semibold text-muted-foreground uppercase">{ACTIVITY_TITLE}</Text>
					{ACTIVITY.map((line: string): React.JSX.Element => (
						<Text key={line} className="text-body font-sans text-muted-foreground">
							{line}
						</Text>
					))}
				</View>
			</Sheet>
		</>
	);
}
