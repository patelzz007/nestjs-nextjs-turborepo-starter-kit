import { FileType } from "@workspace/ui-native/components/file-type";
import * as React from "react";

// The whole file name passed as the type: it is no extension the table knows, so it draws a neutral page labelled with the whole name.
export function FileTypeDont1Example(): React.JSX.Element {
	return <FileType type="Q3 report.pdf" className="self-center" />;
}
