import * as React from "react";

/** A pale yellow: white text on it fails contrast. */
const PALE_BACKGROUND: React.CSSProperties = { backgroundColor: "#facc15" };

export function ColorPickerDont2Example(): React.JSX.Element {
	return (
		<div className="w-full max-w-xs rounded-md p-3 text-sm text-white" style={PALE_BACKGROUND}>
			Pay invoice
		</div>
	);
}
