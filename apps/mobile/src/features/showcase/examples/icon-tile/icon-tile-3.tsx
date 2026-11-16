import { IconTile } from "@workspace/ui-native/components/icon-tile";
import LayoutDashboardIcon from "lucide-react-native/icons/layout-dashboard";
import * as React from "react";

export function IconTile3Example(): React.JSX.Element {
	return <IconTile icon={LayoutDashboardIcon} variant="frame" tone="brand" className="self-center" />;
}
