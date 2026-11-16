import FileTextIcon from "lucide-react-native/icons/file-text";
import FolderIcon from "lucide-react-native/icons/folder";
import { Avatar } from "@workspace/ui-native/components/avatar";
import { IconTile } from "@workspace/ui-native/components/icon-tile";
import { Breadcrumb, type BreadcrumbItemData } from "@workspace/ui-native/components/breadcrumb";
import * as React from "react";

import { ignorePress } from "../example-support";

const ITEMS: readonly BreadcrumbItemData[] = [
	{ key: "project", label: "Acme web", description: "Project", leading: <IconTile icon={FolderIcon} tone="blue" size="sm" />, onPress: ignorePress },
	{ key: "user", label: "Ava Patel", description: "ava@acme.com", leading: <Avatar name="Ava Patel" imageUrl={null} size="sm" />, onPress: ignorePress },
	{ key: "doc", label: "Launch plan", description: "launch-plan.md", leading: <IconTile icon={FileTextIcon} tone="violet" size="sm" /> },
];

export function Breadcrumb15Example(): React.JSX.Element {
	return <Breadcrumb items={ITEMS} />;
}
