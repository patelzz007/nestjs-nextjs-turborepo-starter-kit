"use client";

import type { Action } from "@workspace/ui/components/display/data-table";
import { Button } from "@workspace/ui/components/form/button";
import type { RowData } from "@tanstack/react-table";
import * as React from "react";

export interface DataTableMobileCardField {
	readonly label: string;
	readonly value: React.ReactNode;
}

export interface DataTableMobileCardProps<T extends RowData> {
	readonly item: T;
	readonly title: React.ReactNode;
	readonly subtitle?: React.ReactNode;
	readonly badge?: React.ReactNode;
	readonly fields?: readonly DataTableMobileCardField[];
	readonly actions?: readonly Action<T>[];
}

export function DataTableMobileCard<T extends RowData>({ item, title, subtitle, badge, fields = [], actions }: DataTableMobileCardProps<T>): React.JSX.Element {
	const handleActionClick = React.useCallback(
		(event: React.MouseEvent<HTMLButtonElement>): void => {
			const actionKey = event.currentTarget.dataset.actionKey;
			const action = actions?.find((entry) => entry.key === actionKey);
			if (action !== undefined) {
				action.onClick(item);
			}
		},
		[actions, item],
	);

	return (
		<div className="w-full space-y-3 rounded-lg border bg-card p-4">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0 space-y-1">
					<div className="truncate text-sm font-semibold">{title}</div>
					{subtitle !== undefined && subtitle !== null && subtitle !== "" ? <div className="truncate text-sm text-muted-foreground">{subtitle}</div> : null}
				</div>
				{badge !== undefined ? badge : null}
			</div>
			{fields.length > 0 ? (
				<div className="grid grid-cols-2 gap-2 text-sm">
					{fields.map((field, index) => (
						<div key={`${field.label}-${String(index)}`}>
							<div className="text-muted-foreground">{field.label}</div>
							<div className="font-medium">{field.value}</div>
						</div>
					))}
				</div>
			) : null}
			{actions !== undefined && actions.length > 0 ? (
				<div className="flex flex-col gap-2 border-t pt-3">
					{actions.map((action) => (
						<Button
							key={action.key}
							variant={action.isDestructive === true ? "destructive" : "outline"}
							size="md"
							data-action-key={action.key}
							onClick={handleActionClick}
							className={`w-full ${action.key === "view" || action.key === "edit" || action.key === "manage" ? "bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90" : ""}`}>
							{action.icon}
							<span className="ml-2">{action.label}</span>
						</Button>
					))}
				</div>
			) : null}
		</div>
	);
}
