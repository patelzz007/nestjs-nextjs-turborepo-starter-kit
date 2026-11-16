import { getFileType } from "@workspace/ui-kit-logic";
import { FileType } from "@workspace/ui-native/components/file-type";
import * as React from "react";

export function FileTypeDo1Example(): React.JSX.Element {
	return <FileType type={getFileType("Q3 report.pdf")} className="self-center" />;
}
