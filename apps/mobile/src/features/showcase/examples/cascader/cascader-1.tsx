import AtSignIcon from "lucide-react-native/icons/at-sign";
import CalendarIcon from "lucide-react-native/icons/calendar";
import HashIcon from "lucide-react-native/icons/hash";
import TypeIcon from "lucide-react-native/icons/type";
import { Cascader } from "@workspace/ui-native/components/cascader";
import { Icon } from "@workspace/ui-native/components/icon";
import type { CascaderNode } from "@workspace/ui-native/lib/cascader";
import * as React from "react";

const TEXT = <Icon icon={TypeIcon} size="sm" colorClassName="accent-muted-foreground" />;
const NUMBER = <Icon icon={HashIcon} size="sm" colorClassName="accent-muted-foreground" />;
const DATE = <Icon icon={CalendarIcon} size="sm" colorClassName="accent-muted-foreground" />;
const EMAIL = <Icon icon={AtSignIcon} size="sm" colorClassName="accent-muted-foreground" />;

const ATTRIBUTES: readonly CascaderNode[] = [
	{
		value: "person",
		label: "Person",
		count: 2,
		children: [
			{ value: "person.name", label: "Name", icon: TEXT },
			{
				value: "person.contact",
				label: "Contact",
				count: 2,
				children: [
					{ value: "person.contact.email", label: "Email", icon: EMAIL },
					{ value: "person.contact.phone", label: "Phone", icon: TEXT },
				],
			},
		],
	},
	{
		value: "company",
		label: "Company",
		count: 3,
		children: [
			{ value: "company.name", label: "Name", icon: TEXT },
			{ value: "company.employees", label: "Employees", icon: NUMBER },
			{ value: "company.founded", label: "Founded", icon: DATE },
		],
	},
	{
		value: "workspace",
		label: "Workspace",
		count: 1,
		children: [{ value: "workspace.plan", label: "Plan", icon: TEXT }],
	},
];

export function Cascader1Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("person.contact.email");
	return <Cascader label="Attribute" items={ATTRIBUTES} value={value} onChange={setValue} placeholder="Pick an attribute" maxSegments={3} />;
}
