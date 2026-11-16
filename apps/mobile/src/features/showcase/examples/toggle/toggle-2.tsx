import BoldIcon from "lucide-react-native/icons/bold";
import ItalicIcon from "lucide-react-native/icons/italic";
import { Toggle } from "@workspace/ui-native/components/toggle";
import * as React from "react";
import { View } from "react-native";

export function Toggle2Example(): React.JSX.Element {
	const [italic, setItalic] = React.useState<boolean>(false);
	const [bold, setBold] = React.useState<boolean>(false);
	return (
		<View className="flex-row gap-2">
			<Toggle label="Italic" icon={ItalicIcon} variant="outline" pressed={italic} onChange={setItalic} />
			<Toggle label="Bold" icon={BoldIcon} variant="outline" pressed={bold} onChange={setBold} />
		</View>
	);
}
