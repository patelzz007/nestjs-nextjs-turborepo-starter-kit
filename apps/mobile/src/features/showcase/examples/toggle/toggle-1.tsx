import BoldIcon from "lucide-react-native/icons/bold";
import ItalicIcon from "lucide-react-native/icons/italic";
import UnderlineIcon from "lucide-react-native/icons/underline";
import { Toggle } from "@workspace/ui-native/components/toggle";
import * as React from "react";
import { View } from "react-native";

export function Toggle1Example(): React.JSX.Element {
	const [bold, setBold] = React.useState<boolean>(true);
	const [italic, setItalic] = React.useState<boolean>(false);
	const [underline, setUnderline] = React.useState<boolean>(false);
	return (
		<View className="flex-row gap-2">
			<Toggle label="Bold" icon={BoldIcon} hideLabel pressed={bold} onChange={setBold} />
			<Toggle label="Italic" icon={ItalicIcon} hideLabel pressed={italic} onChange={setItalic} />
			<Toggle label="Underline" icon={UnderlineIcon} hideLabel pressed={underline} onChange={setUnderline} />
		</View>
	);
}
