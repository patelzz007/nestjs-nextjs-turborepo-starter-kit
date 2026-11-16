import { Textarea } from "@workspace/ui-native/components/textarea";
import * as React from "react";

export function Textarea1Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return <Textarea value={value} onChange={setValue} placeholder="Type your message…" accessibilityLabel="Message" />;
}
