import SearchIcon from "lucide-react-native/icons/search";
import { InputGroup } from "@workspace/ui-native/components/input-group";
import * as React from "react";

export function Input30Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return <InputGroup value={value} onChange={setValue} leadingIcon={SearchIcon} placeholder="Search" accessibilityLabel="Search" className="rounded-full px-5" />;
}
