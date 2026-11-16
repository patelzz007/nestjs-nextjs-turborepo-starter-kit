import * as React from "react";
import { NativeSelect, NativeSelectOption } from "@workspace/ui/components/native-select";

export function NativeSelect1Example(): React.JSX.Element {
	return (
		<NativeSelect className="w-full max-w-xs">
			<NativeSelectOption value="">Select a fruit</NativeSelectOption>
			<NativeSelectOption value="apple">Apple</NativeSelectOption>
			<NativeSelectOption value="banana">Banana</NativeSelectOption>
			<NativeSelectOption value="blueberry">Blueberry</NativeSelectOption>
			<NativeSelectOption value="grapes" disabled>
				Grapes
			</NativeSelectOption>
			<NativeSelectOption value="pineapple">Pineapple</NativeSelectOption>
		</NativeSelect>
	);
}
