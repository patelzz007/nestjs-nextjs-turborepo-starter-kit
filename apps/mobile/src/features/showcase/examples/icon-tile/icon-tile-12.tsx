import { EmptyState } from "@workspace/ui-native/components/empty";
import { IconTile } from "@workspace/ui-native/components/icon-tile";
import FolderIcon from "lucide-react-native/icons/folder";
import * as React from "react";

const TILE = <IconTile icon={FolderIcon} variant="frame" tone="brand" size="xl" />;

export function IconTile12Example(): React.JSX.Element {
	return <EmptyState variant="plain" align="center" illustration={TILE} title="No files yet" message="Upload a file to get started. Everything you add shows up here." />;
}
