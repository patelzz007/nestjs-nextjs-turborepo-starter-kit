import MicIcon from "lucide-react-native/icons/mic";
import SendIcon from "lucide-react-native/icons/send";
import { ButtonGroup } from "@workspace/ui-native/components/button-group";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import { Input } from "@workspace/ui-native/components/input";
import * as React from "react";
import { View } from "react-native";

import { ignorePress } from "../example-support";

export function ButtonGroup9Example(): React.JSX.Element {
	const [message, setMessage] = React.useState<string>("");
	return (
		<View className="flex-row gap-2">
			<ButtonGroup accessibilityLabel="Message" className="flex-1">
				<Input value={message} onChange={setMessage} placeholder="Send a message…" accessibilityLabel="Message" className="flex-1" />
				<IconButton icon={MicIcon} label="Voice mode" onPress={ignorePress} className="h-12 w-12" />
			</ButtonGroup>
			<IconButton icon={SendIcon} label="Send" variant="primary" onPress={ignorePress} className="h-12 w-12" />
		</View>
	);
}
