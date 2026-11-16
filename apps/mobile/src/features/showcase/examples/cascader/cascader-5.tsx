import { Avatar } from "@workspace/ui-native/components/avatar";
import { Badge } from "@workspace/ui-native/components/badge";
import { Cascader } from "@workspace/ui-native/components/cascader";
import { cn } from "@workspace/ui-native/lib/cn";
import type { CascaderNode } from "@workspace/ui-native/lib/cascader";
import * as React from "react";
import { View } from "react-native";

interface Member {
	readonly name: string;
	readonly online: boolean;
	readonly level: string;
}

const MEMBERS: Readonly<Record<string, Member>> = {
	ava: { name: "Ava Patel", online: true, level: "Senior" },
	ben: { name: "Ben Ortiz", online: false, level: "Mid" },
	chloe: { name: "Chloe Kim", online: true, level: "Lead" },
	dan: { name: "Dan Rossi", online: false, level: "Junior" },
};

/** A member's face with an online or away dot. */
function Face({ id }: { readonly id: string }): React.JSX.Element {
	const member = MEMBERS[id];
	return (
		<View>
			<Avatar name={member?.name ?? id} imageUrl={null} size="sm" />
			<View className={cn("absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-popover", member?.online === true ? "bg-success" : "bg-muted-foreground")} />
		</View>
	);
}

function memberNode(id: string): CascaderNode {
	return { value: id, label: MEMBERS[id]?.name ?? id, description: MEMBERS[id]?.online === true ? "Online" : "Away", icon: <Face id={id} /> };
}

const TEAMS: readonly CascaderNode[] = [
	{ value: "design", label: "Design", count: 2, children: [memberNode("ava"), memberNode("ben")] },
	{ value: "engineering", label: "Engineering", count: 2, children: [memberNode("chloe"), memberNode("dan")] },
];

/** The member's seniority, after the name. */
function SeniorityChip(node: CascaderNode): React.ReactNode {
	const level = MEMBERS[node.value]?.level;
	return level === undefined ? null : <Badge label={level} size="sm" />;
}

export function Cascader5Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("chloe");
	return <Cascader label="Assignee" items={TEAMS} value={value} onChange={setValue} renderTrailing={SeniorityChip} display="leaf" />;
}
