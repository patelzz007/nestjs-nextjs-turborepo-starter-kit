import * as React from "react";
import { NativeSelect, NativeSelectOption } from "@workspace/ui/components/native-select";

export function NativeSelect5Example(): React.JSX.Element {
	return (
		<NativeSelect disabled className="w-full max-w-xs">
			<NativeSelectOption value="">Disabled Select</NativeSelectOption>
			<NativeSelectOption value="1">Option 1</NativeSelectOption>
		</NativeSelect>
	);
}
