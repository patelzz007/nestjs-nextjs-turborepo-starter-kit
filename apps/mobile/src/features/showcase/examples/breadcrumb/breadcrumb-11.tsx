import { Breadcrumb, type BreadcrumbItemData } from "@workspace/ui-native/components/breadcrumb";
import * as React from "react";

import { ignorePress } from "../example-support";

const ITEMS: readonly BreadcrumbItemData[] = [
	{ key: "mail", label: "Mail", onPress: ignorePress },
	{ key: "inbox", label: "Inbox", badge: "3", onPress: ignorePress },
	{ key: "message", label: "Re: launch plan" },
];

export function Breadcrumb11Example(): React.JSX.Element {
	return <Breadcrumb items={ITEMS} />;
}
