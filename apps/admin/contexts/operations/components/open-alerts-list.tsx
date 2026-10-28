"use client";

// The open alerts as the servers overview shows them, and how each alert rule reads. Its own module so
// the overview does not load the whole Alerts screen (its table and settings form).

import type { OpsAlert, OpsAlertRule } from "@workspace/shared";
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";
import { TriangleAlert } from "lucide-react";
import * as React from "react";

import { formatDateTimeShort } from "../lib/ops-format";

/** How each rule reads. */
export const ALERT_RULE_LABELS: Readonly<Record<OpsAlertRule, string>> = {
	CPU_HIGH: "CPU high",
	MEMORY_HIGH: "Memory high",
	DISK_HIGH: "Disk almost full",
	SILENT: "Stopped reporting",
	DEPENDENCY_DOWN: "Dependency down",
	ENDPOINT_DOWN: "Address not answering",
	TLS_EXPIRING: "Certificate expiring",
};

/** The open alerts, as the overview shows them. */
export function OpenAlertsList({ alerts }: { readonly alerts: readonly OpsAlert[] }): React.JSX.Element {
	return (
		<Alert variant="destructive">
			<TriangleAlert className="size-4" />
			<AlertTitle>{`${String(alerts.length)} open alert${alerts.length === 1 ? "" : "s"}`}</AlertTitle>
			<AlertDescription>
				<ul className="mt-1 space-y-0.5">
					{alerts.map((alert) => (
						<li key={alert.id}>
							{alert.message} · since {formatDateTimeShort(alert.openedAt)}
						</li>
					))}
				</ul>
			</AlertDescription>
		</Alert>
	);
}
