import ChartColumnIcon from "lucide-react-native/icons/chart-column";
import FolderIcon from "lucide-react-native/icons/folder";
import ListChecksIcon from "lucide-react-native/icons/list-checks";
import UsersIcon from "lucide-react-native/icons/users";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui-native/components/tabs";
import type { LucideIcon } from "@workspace/ui-native/components/icon";
import * as React from "react";
import { Text } from "react-native";

const SECTIONS: readonly { readonly value: string; readonly label: string; readonly icon: LucideIcon; readonly count?: string }[] = [
	{ value: "projects", label: "Projects", icon: FolderIcon, count: "8" },
	{ value: "tasks", label: "Tasks", icon: ListChecksIcon, count: "24" },
	{ value: "team", label: "Team", icon: UsersIcon },
	{ value: "reports", label: "Reports", icon: ChartColumnIcon },
];

export function Tabs8Example(): React.JSX.Element {
	const [tab, setTab] = React.useState("projects");
	return (
		<Tabs value={tab} onChange={setTab} orientation="vertical" variant="line">
			<TabsList>
				{SECTIONS.map((section): React.JSX.Element => (
					<TabsTrigger key={section.value} value={section.value} label={section.label} icon={section.icon} badge={section.count} />
				))}
			</TabsList>
			{SECTIONS.map((section): React.JSX.Element => (
				<TabsContent key={section.value} value={section.value} className="flex-1">
					<Text className="text-body font-sans text-muted-foreground">{`${section.label} appear here.`}</Text>
				</TabsContent>
			))}
		</Tabs>
	);
}
