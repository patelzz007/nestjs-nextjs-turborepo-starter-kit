import { Badge } from "@workspace/ui-native/components/badge";
import { Card, CardContent } from "@workspace/ui-native/components/card";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import { Separator } from "@workspace/ui-native/components/separator";
import ArrowDownIcon from "lucide-react-native/icons/arrow-down";
import ArrowUpIcon from "lucide-react-native/icons/arrow-up";
import EllipsisIcon from "lucide-react-native/icons/ellipsis";
import PinIcon from "lucide-react-native/icons/pin";
import SettingsIcon from "lucide-react-native/icons/settings";
import Share2Icon from "lucide-react-native/icons/share-2";
import TrashIcon from "lucide-react-native/icons/trash";
import TriangleAlertIcon from "lucide-react-native/icons/triangle-alert";
import * as React from "react";
import { Text, View } from "react-native";

import { ignorePress } from "../example-support";

/** The sample KPI the card shows. */
interface RevenueMetric {
	readonly title: string;
	readonly value: string;
	/** Change against last month, in percent. */
	readonly delta: number;
	readonly positive: boolean;
	readonly lastMonth: string;
}

const METRIC: RevenueMetric = { title: "Revenue", value: "$12.4k", delta: 12.5, positive: true, lastMonth: "$11.0k" };

const ACTIONS: readonly DropdownMenuItemData<string>[] = [
	{ value: "settings", label: "Settings", icon: SettingsIcon },
	{ value: "alert", label: "Add Alert", icon: TriangleAlertIcon },
	{ value: "pin", label: "Pin to Dashboard", icon: PinIcon },
	{ value: "share", label: "Share", icon: Share2Icon },
	{ value: "remove", label: "Remove", icon: TrashIcon, variant: "destructive" },
];

export function Card15Example(): React.JSX.Element {
	const { title, value, delta, positive, lastMonth } = METRIC;
	return (
		<Card>
			<CardContent className="gap-5">
				<View className="flex-row items-center justify-between gap-3">
					<Text className="text-label font-sans-medium text-muted-foreground">{title}</Text>
					<DropdownMenu label="More options" icon={EllipsisIcon} size="icon" variant="ghost" items={ACTIONS} onSelect={ignorePress} />
				</View>
				<View className="gap-2.5">
					<View className="flex-row items-center gap-2.5">
						<Text className="text-h3 font-sans-medium tracking-tight text-foreground tabular-nums">{value}</Text>
						<Badge label={`${String(delta)}%`} tone={positive ? "success" : "destructive"} variant="light" icon={positive ? ArrowUpIcon : ArrowDownIcon} />
					</View>
					<Separator />
					<Text className="text-caption font-sans text-muted-foreground">
						Vs last month: <Text className="font-sans-medium text-foreground tabular-nums">{lastMonth}</Text>
					</Text>
				</View>
			</CardContent>
		</Card>
	);
}
