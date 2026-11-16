import { Badge } from "@workspace/ui-native/components/badge";
import { Frame, FrameHeader, FramePanel, FrameTitle } from "@workspace/ui-native/components/frame";
import { Icon, type LucideIcon } from "@workspace/ui-native/components/icon";
import { Sortable, SortableItem, SortableItemHandle } from "@workspace/ui-native/components/sortable";
import CalendarIcon from "lucide-react-native/icons/calendar";
import ChartColumnIcon from "lucide-react-native/icons/chart-column";
import FolderIcon from "lucide-react-native/icons/folder";
import GripVerticalIcon from "lucide-react-native/icons/grip-vertical";
import InboxIcon from "lucide-react-native/icons/inbox";
import LayoutDashboardIcon from "lucide-react-native/icons/layout-dashboard";
import SettingsIcon from "lucide-react-native/icons/settings";
import * as React from "react";
import { Text, View } from "react-native";

interface NavItem {
	readonly id: string;
	readonly label: string;
	readonly icon: LucideIcon;
	readonly count?: number | undefined;
}

const ITEMS: readonly NavItem[] = [
	{ id: "dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
	{ id: "inbox", label: "Inbox", icon: InboxIcon, count: 5 },
	{ id: "projects", label: "Projects", icon: FolderIcon, count: 12 },
	{ id: "calendar", label: "Calendar", icon: CalendarIcon },
	{ id: "analytics", label: "Analytics", icon: ChartColumnIcon },
	{ id: "settings", label: "Settings", icon: SettingsIcon },
];

const TITLE = "Navigation";

function getItemValue(item: NavItem): string {
	return item.id;
}

export function Sortable6Example(): React.JSX.Element {
	const [items, setItems] = React.useState<readonly NavItem[]>(ITEMS);
	return (
		<Frame className="w-64 self-center">
			<FrameHeader>
				<FrameTitle>{TITLE}</FrameTitle>
			</FrameHeader>
			<FramePanel className="p-1">
				<Sortable value={items} onValueChange={setItems} getItemValue={getItemValue} className="gap-0.5">
					{items.map((item: NavItem): React.JSX.Element => (
						<SortableItem key={item.id} value={item.id} label={item.label}>
							<View className="flex-row items-center gap-2 rounded-md px-1">
								<Icon icon={item.icon} size="sm" colorClassName="accent-muted-foreground" />
								<Text className="text-label flex-1 font-sans text-foreground">{item.label}</Text>
								{item.count === undefined ? null : <Badge label={String(item.count)} variant="outline" size="sm" />}
								<SortableItemHandle>
									<Icon icon={GripVerticalIcon} size="sm" colorClassName="accent-muted-foreground" />
								</SortableItemHandle>
							</View>
						</SortableItem>
					))}
				</Sortable>
			</FramePanel>
		</Frame>
	);
}
