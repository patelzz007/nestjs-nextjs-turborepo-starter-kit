import { Attachment } from "@workspace/ui-native/components/attachment";
import * as React from "react";

import FileTextIcon from "lucide-react-native/icons/file-text";

export function AttachmentDo1Example(): React.JSX.Element {
	return <Attachment name="invoice-3182.pdf" description="PDF · 240 KB" icon={FileTextIcon} />;
}
