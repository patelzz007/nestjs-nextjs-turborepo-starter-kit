import type { LucideIcon } from "@workspace/ui-native/components/icon";
import { Button } from "@workspace/ui-native/components/button";
import BookmarkIcon from "lucide-react-native/icons/bookmark";
import DownloadIcon from "lucide-react-native/icons/download";
import SendIcon from "lucide-react-native/icons/send";
import * as React from "react";
import { View } from "react-native";

import { useToast } from "../../../toast/facade";

// `icon` gives a toast a glyph of the caller's.
interface IconOption {
	readonly label: string;
	readonly icon: LucideIcon;
	readonly title: string;
	readonly message: string;
}

const ICON_OPTIONS: readonly IconOption[] = [
	{ label: "Send Icon", icon: SendIcon, title: "Message sent", message: "Your message has been delivered." },
	{ label: "Download Icon", icon: DownloadIcon, title: "Download complete", message: "design-assets.zip is ready." },
	{ label: "Bookmark Icon", icon: BookmarkIcon, title: "Bookmark added", message: "Saved to your collection." },
];

function IconButton({ option, onSelect }: { readonly option: IconOption; readonly onSelect: (option: IconOption) => void }): React.JSX.Element {
	const press = React.useCallback((): void => {
		onSelect(option);
	}, [onSelect, option]);
	return <Button label={option.label} icon={option.icon} size="sm" variant="outline" onPress={press} />;
}

export function Sonner19Example(): React.JSX.Element {
	const toast = useToast();
	const showWith = React.useCallback(
		(option: IconOption): void => {
			toast.show("default", option.message, { title: option.title, icon: option.icon });
		},
		[toast],
	);
	return (
		<View className="flex-row flex-wrap justify-center gap-2">
			{ICON_OPTIONS.map((option: IconOption): React.JSX.Element => (
				<IconButton key={option.label} option={option} onSelect={showWith} />
			))}
		</View>
	);
}
