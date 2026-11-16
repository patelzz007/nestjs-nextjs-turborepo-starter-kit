import * as React from "react";
import { NativeSelect, NativeSelectOption } from "@workspace/ui/components/native-select";

export function NativeSelect6Example(): React.JSX.Element {
	return (
		<NativeSelect aria-invalid="true" className="w-full max-w-xs">
			<NativeSelectOption value="">Invalid Select</NativeSelectOption>
			<NativeSelectOption value="1">Option 1</NativeSelectOption>
		</NativeSelect>
	);
}
