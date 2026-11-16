import BoldIcon from "lucide-react-native/icons/bold";
import ItalicIcon from "lucide-react-native/icons/italic";
import StrikethroughIcon from "lucide-react-native/icons/strikethrough";
import UnderlineIcon from "lucide-react-native/icons/underline";
import { Toggle } from "@workspace/ui-native/components/toggle";
import * as React from "react";
import { View } from "react-native";

export function Toggle13Example(): React.JSX.Element {
	const [bold, setBold] = React.useState<boolean>(false);
	const [italic, setItalic] = React.useState<boolean>(false);
	return (
		<View className="flex-row gap-2">
			<Toggle label="Bold" icon={BoldIcon} hideLabel pressed={bold} onChange={setBold} />
			<Toggle label="Italic" icon={ItalicIcon} hideLabel pressed={italic} onChange={setItalic} />
			<Toggle label="Underline" icon={UnderlineIcon} hideLabel disabled pressed={false} onChange={setItalic} />
			<Toggle label="Strikethrough" icon={StrikethroughIcon} hideLabel disabled pressed={false} onChange={setItalic} />
		</View>
	);
}
