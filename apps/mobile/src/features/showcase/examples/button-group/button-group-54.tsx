import { ButtonGroup } from "@workspace/ui-native/components/button-group";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import * as React from "react";

const SERVICES: readonly DropdownMenuItemData<string>[] = [
	{ value: "payments", label: "payments" },
	{ value: "ledger", label: "ledger" },
];

const ENVIRONMENTS: readonly DropdownMenuItemData<string>[] = [
	{ value: "prod", label: "prod" },
	{ value: "staging", label: "staging" },
];

const VERSIONS: readonly DropdownMenuItemData<string>[] = [
	{ value: "v2.4.1", label: "v2.4.1" },
	{ value: "v2.4.0", label: "v2.4.0" },
];

export function ButtonGroup54Example(): React.JSX.Element {
	const [service, setService] = React.useState<string>("payments");
	const [environment, setEnvironment] = React.useState<string>("prod");
	const [version, setVersion] = React.useState<string>("v2.4.1");
	return (
		<ButtonGroup size="sm" accessibilityLabel="API service" className="self-start">
			<DropdownMenu label={service} size="sm" title="Service" items={SERVICES} onSelect={setService} />
			<DropdownMenu label={environment} size="sm" title="Environment" items={ENVIRONMENTS} onSelect={setEnvironment} />
			<DropdownMenu label={version} size="sm" title="Version" items={VERSIONS} onSelect={setVersion} />
		</ButtonGroup>
	);
}
