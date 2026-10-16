"use client";

import { Button } from "@workspace/ui/components/button";
import { toast, toastMessage } from "@workspace/ui/components/toast";
import type * as React from "react";

// A deployment report: the details go in the description as label/value rows,
// and "View Logs" is the toast's action.

interface DeploymentDetail {
	readonly label: string;
	readonly value: string;
	readonly mono?: boolean;
}

const DEPLOYMENT_DETAILS: readonly DeploymentDetail[] = [
	{ label: "Environment", value: "Production" },
	{ label: "Duration", value: "42s" },
	{ label: "Commit", value: "a1b2c3d", mono: true },
];

const DEPLOYMENT_DESCRIPTION = (
	<span className="mt-1 flex flex-col gap-1 text-xs">
		{DEPLOYMENT_DETAILS.map((detail: DeploymentDetail): React.JSX.Element => (
			<span key={detail.label} className="flex items-center justify-between gap-4">
				<span>{detail.label}</span>
				<span className={detail.mono === true ? "font-mono font-medium text-foreground" : "font-medium text-foreground"}>{detail.value}</span>
			</span>
		))}
	</span>
);

function showDeploymentToast(): void {
	const id = toastMessage.success({
		title: "Deployment Successful",
		description: DEPLOYMENT_DESCRIPTION,
		actionProps: {
			children: "View Logs",
			onClick: (): void => {
				toast.close(id);
			},
		},
	});
}

export function Sonner11Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<Button onClick={showDeploymentToast} variant="outline" className="w-fit">
				Deployment Toast
			</Button>
		</div>
	);
}
