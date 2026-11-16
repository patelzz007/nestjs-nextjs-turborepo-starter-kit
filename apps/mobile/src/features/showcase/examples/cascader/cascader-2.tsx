import { Button } from "@workspace/ui-native/components/button";
import { Cascader } from "@workspace/ui-native/components/cascader";
import type { CascaderNode } from "@workspace/ui-native/lib/cascader";
import * as React from "react";

const PERMISSIONS: readonly CascaderNode[] = [
	{
		value: "billing",
		label: "Billing",
		children: [
			{ value: "billing.read", label: "View invoices" },
			{ value: "billing.pay", label: "Update payment methods" },
			{ value: "billing.refund", label: "Issue refunds", disabled: true, description: "Owners only" },
		],
	},
	{
		value: "deployments",
		label: "Deployments",
		children: [
			{ value: "deploy.create", label: "Create deployments" },
			{ value: "deploy.rollback", label: "Roll back" },
			{ value: "deploy.env", label: "Edit environment variables" },
		],
	},
	{
		value: "analytics",
		label: "Analytics",
		children: [
			{ value: "analytics.view", label: "View dashboards" },
			{ value: "analytics.export", label: "Export data" },
		],
	},
];

/** The most permissions one role may hold. */
const MAX_PERMISSIONS = 5;
const NONE: readonly string[] = [];
const INITIAL: readonly string[] = ["billing.read", "deploy.create"];

export function Cascader2Example(): React.JSX.Element {
	const [values, setValues] = React.useState<readonly string[]>(INITIAL);
	const clear = React.useCallback((): void => {
		setValues(NONE);
	}, []);
	const footer = <Button label="Clear all" variant="ghost" size="sm" onPress={clear} disabled={values.length === 0} />;
	return (
		<Cascader
			label="Permissions"
			items={PERMISSIONS}
			multiple
			max={MAX_PERMISSIONS}
			value={values}
			onChange={setValues}
			onClear={clear}
			footer={footer}
			hint={`Up to ${String(MAX_PERMISSIONS)}.`}
			placeholder="Pick permissions"
		/>
	);
}
