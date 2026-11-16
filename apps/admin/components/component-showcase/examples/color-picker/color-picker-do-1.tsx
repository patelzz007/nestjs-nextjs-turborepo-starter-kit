import * as React from "react";
import { ColorPicker, ColorPickerPanel } from "@workspace/ui/components/color-picker";

/** The brand's colours, offered first. */
const BRAND_SWATCHES: readonly string[] = ["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#e11d48"];

export function ColorPickerDo1Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("#4f46e5");
	return (
		<div className="w-full max-w-80">
			<ColorPicker value={value} onValueChange={setValue} swatches={BRAND_SWATCHES} aria-label="Accent colour">
				<ColorPickerPanel />
			</ColorPicker>
		</div>
	);
}
