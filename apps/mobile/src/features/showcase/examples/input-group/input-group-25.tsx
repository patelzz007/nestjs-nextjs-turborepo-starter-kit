import SearchIcon from "lucide-react-native/icons/search";
import { InputGroup } from "@workspace/ui-native/components/input-group";
import * as React from "react";

export function InputGroup25Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("timeout");
	return <InputGroup value={value} onChange={setValue} leadingIcon={SearchIcon} trailingText="12 results" accessibilityLabel="Search logs" />;
}
