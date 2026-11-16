import { IconTile } from "@workspace/ui-native/components/icon-tile";
import FolderIcon from "lucide-react-native/icons/folder";
import * as React from "react";

export function IconTile1Example(): React.JSX.Element {
	return <IconTile icon={FolderIcon} variant="outline" tone="brand" className="self-center" />;
}
