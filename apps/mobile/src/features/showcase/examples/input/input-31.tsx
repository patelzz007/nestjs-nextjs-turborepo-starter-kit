import { Input } from "@workspace/ui-native/components/input";
import * as React from "react";

export function Input31Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return <Input value={value} onChange={setValue} variant="ghost" placeholder="Untitled" accessibilityLabel="Title" className="px-0" />;
}
