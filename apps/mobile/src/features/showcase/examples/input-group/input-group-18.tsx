import ArrowUpIcon from "lucide-react-native/icons/arrow-up";
import GlobeIcon from "lucide-react-native/icons/globe";
import MicIcon from "lucide-react-native/icons/mic";
import PlusIcon from "lucide-react-native/icons/plus";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import { InputGroup } from "@workspace/ui-native/components/input-group";
import * as React from "react";

import { ignorePress } from "../example-support";

export function InputGroup18Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return (
		<InputGroup
			value={value}
			onChange={setValue}
			multiline
			placeholder="Ask anything…"
			accessibilityLabel="Prompt"
			footer={
				<>
					<IconButton icon={PlusIcon} label="Add" variant="ghost" size="sm" onPress={ignorePress} />
					<IconButton icon={MicIcon} label="Voice" variant="ghost" size="sm" onPress={ignorePress} />
					<IconButton icon={GlobeIcon} label="Search the web" variant="ghost" size="sm" onPress={ignorePress} />
					<IconButton icon={ArrowUpIcon} label="Send" variant="primary" size="sm" onPress={ignorePress} className="ml-auto" />
				</>
			}
		/>
	);
}
