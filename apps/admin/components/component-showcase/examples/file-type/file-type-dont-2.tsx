import * as React from "react";
import { FileType } from "@workspace/ui/components/file-type";

export function FileTypeDont2Example(): React.JSX.Element {
	return <FileType type="xlsx" className="[&_svg]:text-destructive" />;
}
