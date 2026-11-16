import { Badge, type BadgeTone } from "@workspace/ui-native/components/badge";
import { Icon, type LucideIcon } from "@workspace/ui-native/components/icon";
import { Marker, MarkerContent, MarkerIcon } from "@workspace/ui-native/components/marker";
import PencilIcon from "lucide-react-native/icons/pencil";
import PlusIcon from "lucide-react-native/icons/plus";
import Trash2Icon from "lucide-react-native/icons/trash-2";
import * as React from "react";
import { Text, View } from "react-native";

type ChangeKind = "added" | "modified" | "removed";

interface Change {
	readonly path: string;
	readonly kind: ChangeKind;
	readonly delta: string;
}

const CHANGES: readonly Change[] = [
	{ path: "src/lib/rate-limit.ts", kind: "added", delta: "+64" },
	{ path: "src/app/api/send/route.ts", kind: "modified", delta: "+18 -4" },
	{ path: "src/db/schema.ts", kind: "modified", delta: "+6 -1" },
	{ path: "src/lib/legacy-throttle.ts", kind: "removed", delta: "-91" },
	{ path: "README.md", kind: "modified", delta: "+3" },
];

const ICONS: Readonly<Record<ChangeKind, LucideIcon>> = { added: PlusIcon, modified: PencilIcon, removed: Trash2Icon };
const TONES: Readonly<Record<ChangeKind, BadgeTone>> = { added: "success", modified: "info", removed: "destructive" };

// The border variant rules a row off from the one below it, so the last row drops back to the default.
export function Marker5Example(): React.JSX.Element {
	return (
		<View className="gap-2">
			{CHANGES.map((change: Change, position: number): React.JSX.Element => (
				<Marker key={change.path} variant={position < CHANGES.length - 1 ? "border" : "default"}>
					<MarkerIcon>
						<Icon icon={ICONS[change.kind]} size="sm" colorClassName="accent-muted-foreground" />
					</MarkerIcon>
					<MarkerContent className="font-code text-caption flex-1">{change.path}</MarkerContent>
					<Badge label={change.kind} tone={TONES[change.kind]} variant="light" size="sm" />
					<Text className="text-caption font-sans text-muted-foreground tabular-nums">{change.delta}</Text>
				</Marker>
			))}
		</View>
	);
}
