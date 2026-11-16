import DownloadIcon from "lucide-react-native/icons/download";
import PaperclipIcon from "lucide-react-native/icons/paperclip";
import { Button } from "@workspace/ui-native/components/button";
import { ButtonGroup } from "@workspace/ui-native/components/button-group";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import * as React from "react";
import { Text } from "react-native";

import { ignorePress } from "../example-support";

export function ButtonGroup56Example(): React.JSX.Element {
	return (
		<ButtonGroup size="sm" accessibilityLabel="Attachment" className="self-start">
			<Button
				label="contract.pdf"
				variant="outline"
				size="xs"
				icon={PaperclipIcon}
				trailing={<Text className="text-caption font-sans text-muted-foreground">2.4 MB</Text>}
				onPress={ignorePress}
			/>
			<IconButton icon={DownloadIcon} label="Download contract.pdf" size="xs" onPress={ignorePress} />
		</ButtonGroup>
	);
}
