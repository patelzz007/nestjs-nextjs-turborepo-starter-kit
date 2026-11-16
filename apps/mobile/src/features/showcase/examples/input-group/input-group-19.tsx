import PaperclipIcon from "lucide-react-native/icons/paperclip";
import SendIcon from "lucide-react-native/icons/send";
import { Badge } from "@workspace/ui-native/components/badge";
import { Button } from "@workspace/ui-native/components/button";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import { InputGroup } from "@workspace/ui-native/components/input-group";
import * as React from "react";

import { ignorePress } from "../example-support";

export function InputGroup19Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return (
		<InputGroup
			value={value}
			onChange={setValue}
			multiline
			placeholder="Message the team…"
			accessibilityLabel="Message"
			header={
				<>
					<Button label="@ Mention" variant="outline" size="xs" onPress={ignorePress} />
					<Badge label="brief.pdf" icon={PaperclipIcon} variant="outline" size="sm" />
				</>
			}
			footer={<IconButton icon={SendIcon} label="Send" variant="primary" size="sm" onPress={ignorePress} className="ml-auto" />}
		/>
	);
}
