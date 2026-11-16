import { IconTile } from "@workspace/ui-native/components/icon-tile";
import PackageIcon from "lucide-react-native/icons/package";
import * as React from "react";

export function IconTile2Example(): React.JSX.Element {
	return <IconTile icon={PackageIcon} variant="elevated" tone="brand" className="self-center" />;
}
