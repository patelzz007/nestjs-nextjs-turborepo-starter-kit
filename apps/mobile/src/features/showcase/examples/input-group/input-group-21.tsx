import CopyIcon from "lucide-react-native/icons/copy";
import StarIcon from "lucide-react-native/icons/star";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import { InputGroup } from "@workspace/ui-native/components/input-group";
import * as React from "react";

import { ignorePress } from "../example-support";

export function InputGroup21Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("tok_live_51Hx");
	return (
		<InputGroup
			value={value}
			onChange={setValue}
			accessibilityLabel="Token"
			trailing={
				<>
					<IconButton icon={StarIcon} label="Favourite" variant="ghost" size="sm" onPress={ignorePress} />
					<IconButton icon={CopyIcon} label="Copy" variant="ghost" size="sm" onPress={ignorePress} />
				</>
			}
		/>
	);
}
