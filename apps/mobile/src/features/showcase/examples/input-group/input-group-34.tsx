import AudioLinesIcon from "lucide-react-native/icons/audio-lines";
import MicIcon from "lucide-react-native/icons/mic";
import PlusIcon from "lucide-react-native/icons/plus";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import { InputGroup } from "@workspace/ui-native/components/input-group";
import * as React from "react";

import { ignorePress } from "../example-support";

export function InputGroup34Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return (
		<InputGroup
			value={value}
			onChange={setValue}
			placeholder="Ask anything"
			accessibilityLabel="Prompt"
			className="min-h-14 rounded-full pr-1.5 pl-1.5"
			leading={<IconButton icon={PlusIcon} label="Tools" variant="ghost" size="sm" onPress={ignorePress} />}
			trailing={
				<>
					<IconButton icon={MicIcon} label="Dictate" variant="ghost" size="sm" onPress={ignorePress} />
					<IconButton icon={AudioLinesIcon} label="Voice mode" variant="primary" size="sm" onPress={ignorePress} className="rounded-full" />
				</>
			}
		/>
	);
}
