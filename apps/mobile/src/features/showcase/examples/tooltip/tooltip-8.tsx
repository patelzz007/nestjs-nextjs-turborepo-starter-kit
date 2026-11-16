import BoldIcon from "lucide-react-native/icons/bold";
import ImageIcon from "lucide-react-native/icons/image";
import ItalicIcon from "lucide-react-native/icons/italic";
import UnderlineIcon from "lucide-react-native/icons/underline";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import { type LucideIcon } from "@workspace/ui-native/components/icon";
import { Tooltip } from "@workspace/ui-native/components/tooltip";
import * as React from "react";
import { View } from "react-native";

import { ignorePress } from "../example-support";

const TOOLS: readonly { readonly label: string; readonly icon: LucideIcon }[] = [
	{ label: "Bold", icon: BoldIcon },
	{ label: "Italic", icon: ItalicIcon },
	{ label: "Underline", icon: UnderlineIcon },
	{ label: "Insert image", icon: ImageIcon },
];

export function Tooltip8Example(): React.JSX.Element {
	return (
		<View className="flex-row gap-1 self-start rounded-lg border border-border p-1">
			{TOOLS.map((tool): React.JSX.Element => (
				<Tooltip key={tool.label} content={tool.label} accessibilityLabel={tool.label} asChild>
					<IconButton icon={tool.icon} label={tool.label} variant="ghost" size="sm" onPress={ignorePress} />
				</Tooltip>
			))}
		</View>
	);
}
