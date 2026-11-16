import ArrowLeftIcon from "lucide-react-native/icons/arrow-left";
import MicIcon from "lucide-react-native/icons/mic";
import { Kbd } from "@workspace/ui-native/components/kbd";
import * as React from "react";
import { View } from "react-native";

export function Kbd3Example(): React.JSX.Element {
	return (
		<View className="flex-row items-center gap-2">
			<Kbd label="Left" icon={ArrowLeftIcon} />
			<Kbd label="Voice enabled" icon={MicIcon} />
		</View>
	);
}
