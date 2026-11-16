import { Icon, type LucideIcon } from "@workspace/ui-native/components/icon";
import { Marker, MarkerContent, MarkerIcon } from "@workspace/ui-native/components/marker";
import BookOpenIcon from "lucide-react-native/icons/book-open";
import FileTextIcon from "lucide-react-native/icons/file-text";
import GitBranchIcon from "lucide-react-native/icons/git-branch";
import PencilIcon from "lucide-react-native/icons/pencil";
import SearchIcon from "lucide-react-native/icons/search";
import TerminalIcon from "lucide-react-native/icons/terminal";
import * as React from "react";
import { View } from "react-native";

interface ToolCall {
	readonly id: string;
	readonly label: string;
	readonly icon: LucideIcon;
}

const TOOL_CALLS: readonly ToolCall[] = [
	{ id: "checkout", label: "Checked out fix/rate-limit-window", icon: GitBranchIcon },
	{ id: "search", label: "Searched 214 files for rateLimit(", icon: SearchIcon },
	{ id: "read", label: "Read src/lib/rate-limit.ts", icon: FileTextIcon },
	{ id: "edit", label: "Edited src/lib/rate-limit.ts, 2 hunks", icon: PencilIcon },
	{ id: "test", label: "Ran pnpm test rate-limit", icon: TerminalIcon },
	{ id: "docs", label: "Read the Upstash quota docs", icon: BookOpenIcon },
];

// The glyph is hidden from screen readers, so each label reads as a complete line of the log.
export function Marker2Example(): React.JSX.Element {
	return (
		<View className="gap-3">
			{TOOL_CALLS.map((call: ToolCall): React.JSX.Element => (
				<Marker key={call.id}>
					<MarkerIcon>
						<Icon icon={call.icon} size="sm" colorClassName="accent-muted-foreground" />
					</MarkerIcon>
					<MarkerContent>{call.label}</MarkerContent>
				</Marker>
			))}
		</View>
	);
}
