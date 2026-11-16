import MicIcon from "lucide-react-native/icons/mic";
import { InputGroup } from "@workspace/ui-native/components/input-group";
import { PulseDot } from "@workspace/ui-native/components/pulse-dot";
import * as React from "react";

export function InputGroup6Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return (
		<InputGroup value={value} onChange={setValue} leadingIcon={MicIcon} trailing={<PulseDot tone="destructive" />} placeholder="Listening…" accessibilityLabel="Dictation" />
	);
}
