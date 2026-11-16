import * as React from "react";
import { NativeSelect, NativeSelectOption } from "@workspace/ui/components/native-select";

export function NativeSelect3Example(): React.JSX.Element {
	return (
		<NativeSelect size="sm" className="w-full max-w-xs">
			<NativeSelectOption value="">Small Select</NativeSelectOption>
			<NativeSelectOption value="1">Option 1</NativeSelectOption>
			<NativeSelectOption value="2">Option 2</NativeSelectOption>
		</NativeSelect>
	);
}
