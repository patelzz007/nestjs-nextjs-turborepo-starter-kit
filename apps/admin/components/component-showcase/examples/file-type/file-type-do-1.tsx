import * as React from "react";
import { FileType, getFileType } from "@workspace/ui/components/file-type";

export function FileTypeDo1Example(): React.JSX.Element {
	return <FileType type={getFileType("quarterly-report.xlsx")} />;
}
