import * as React from "react";
import { ColorPicker, ColorPickerPanel } from "@workspace/ui/components/color-picker";

export function ColorPickerDont1Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("#4f46e5");
	return (
		<div className="w-full max-w-80">
			<ColorPicker value={value} onValueChange={setValue} aria-label="Accent colour">
				<ColorPickerPanel />
			</ColorPicker>
		</div>
	);
}
