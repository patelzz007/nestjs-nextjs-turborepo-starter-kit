"use client";

import type { RollbackPlan } from "@workspace/cli/generator";
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogTitle,
	confirmDialogLabels,
} from "@workspace/ui/components/overlay/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/feedback/alert";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { Spinner } from "@workspace/ui/components/feedback/spinner";
import { toastMessage } from "@workspace/ui/components/feedback/toast";
import { Button } from "@workspace/ui/components/form/button";
import { Checkbox } from "@workspace/ui/components/form/checkbox";
import { Label } from "@workspace/ui/components/form/label";
import { SHOWCASE_ALERT_DIALOG_LABELS } from "@workspace/ui/lib/alert-dialog-labels";
import { Undo2 } from "lucide-react";
import * as React from "react";

import { applyResourceRollbackAction, previewResourceRollbackAction } from "@/lib/generator/actions";

const ROLLBACK_DIALOG_LABELS = confirmDialogLabels({
	...SHOWCASE_ALERT_DIALOG_LABELS,
	confirm: "Apply rollback",
	loading: "Rolling back…",
});

const ACTION_VARIANT: Record<RollbackPlan["steps"][number]["action"], "default" | "secondary" | "outline" | "destructive"> = {
	unpatch: "secondary",
	delete: "destructive",
	"remove-directory": "outline",
};

export interface GeneratorRollbackDialogProps {
	readonly slug: string;
	readonly label: string;
	readonly open?: boolean;
	readonly onOpenChange?: (open: boolean) => void;
	readonly showTrigger?: boolean;
	readonly onSuccess?: () => void;
}

export function GeneratorRollbackDialog({
	slug,
	label,
	open: openProp,
	onOpenChange,
	showTrigger = true,
	onSuccess,
}: GeneratorRollbackDialogProps): React.JSX.Element {
	const [internalOpen, setInternalOpen] = React.useState(false);
	const isControlled = openProp !== undefined && onOpenChange !== undefined;
	const open = isControlled ? openProp : internalOpen;
	const setOpen = isControlled ? onOpenChange : setInternalOpen;
	const [includeDefinition, setIncludeDefinition] = React.useState(false);
	const [dryRun, setDryRun] = React.useState(false);
	const [loading, setLoading] = React.useState(false);
	const [applying, setApplying] = React.useState(false);
	const [plan, setPlan] = React.useState<RollbackPlan | null>(null);

	const loadPlan = React.useCallback(async (): Promise<void> => {
		setLoading(true);
		try {
			const nextPlan = await previewResourceRollbackAction(slug, includeDefinition);
			setPlan(nextPlan);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Failed to build rollback plan.";
			toastMessage.error({ title: "Rollback preview failed", description: message });
			setPlan(null);
		} finally {
			setLoading(false);
		}
	}, [includeDefinition, slug]);

	React.useEffect(() => {
		if (!open) {
			return;
		}
		void loadPlan();
	}, [open, includeDefinition, loadPlan]);

	const handleOpen = (): void => {
		setOpen(true);
	};

	const handleOpenChange = React.useCallback(
		(nextOpen: boolean): void => {
			if (!nextOpen) {
				setPlan(null);
				setIncludeDefinition(false);
				setDryRun(false);
			}
			setOpen(nextOpen);
		},
		[setOpen],
	);

	const handleConfirm = (): void => {
		if (!canConfirm) {
			return;
		}
		void (async (): Promise<void> => {
			setApplying(true);
			try {
				const result = await applyResourceRollbackAction(slug, includeDefinition, dryRun);
				if (dryRun) {
					setPlan(result.plan);
					toastMessage.success({
						title: "Dry-run complete",
						description: `${String(result.plan.steps.length)} rollback step(s) would run for ${label}.`,
					});
					return;
				}
				if (!result.applied) {
					toastMessage.error({ title: "Rollback failed", description: "No changes were applied." });
					return;
				}
				toastMessage.success({
					title: "Rollback complete",
					description: `${label} generator artifacts were removed.`,
				});
				onSuccess?.();
				setOpen(false);
			} catch (error) {
				const message = error instanceof Error ? error.message : "Rollback failed.";
				toastMessage.error({ title: "Rollback failed", description: message });
			} finally {
				setApplying(false);
			}
		})();
	};

	const canConfirm = plan !== null && plan.canRollback && !loading;

	return (
		<>
			{showTrigger ? (
				<Button type="button" variant="outline" size="sm" onClick={handleOpen}>
					<Undo2 className="size-4" aria-hidden="true" />
					Rollback
				</Button>
			) : null}

			<AlertDialog open={open} onOpenChange={handleOpenChange}>
				<AlertDialogContent
					className="max-w-2xl"
					severity="critical"
					labels={ROLLBACK_DIALOG_LABELS}
					confirmLoading={applying}
					onConfirm={handleConfirm}
				>
					<AlertDialogTitle>Rollback {label}</AlertDialogTitle>
					<AlertDialogDescription>
						This removes generator artifacts for <code className="rounded bg-muted px-1">{slug}</code> and restores shared files to their pre-generate
						state.
					</AlertDialogDescription>

					<div className="grid gap-4">
						<div className="flex items-center gap-2">
							<Checkbox
								id={`rollback-include-definition-${slug}`}
								checked={includeDefinition}
								onCheckedChange={(checked) => {
									setIncludeDefinition(checked === true);
								}}
							/>
							<Label htmlFor={`rollback-include-definition-${slug}`}>Also delete the .resource.ts definition</Label>
						</div>

						<div className="flex items-center gap-2">
							<Checkbox
								id={`rollback-dry-run-${slug}`}
								checked={dryRun}
								onCheckedChange={(checked) => {
									setDryRun(checked === true);
								}}
							/>
							<Label htmlFor={`rollback-dry-run-${slug}`}>Dry-run only (preview without applying)</Label>
						</div>

						{loading ? (
							<div className="flex items-center gap-2 text-sm text-muted-foreground">
								<Spinner className="size-4" />
								Building rollback plan…
							</div>
						) : null}

						{plan !== null && !plan.canRollback && !loading ? (
							<Alert variant="destructive">
								<AlertTitle>Rollback unavailable</AlertTitle>
								<AlertDescription>{plan.warnings[0] ?? `No rollback data found for ${slug}.`}</AlertDescription>
							</Alert>
						) : null}

						{plan !== null && plan.canRollback && !loading ? (
							<div className="max-h-64 overflow-auto rounded-xl border">
								<ul className="divide-y">
									{plan.steps.map((step) => (
										<li key={`${step.action}-${step.path}`} className="grid gap-1 px-4 py-3 text-sm">
											<div className="flex items-center gap-2">
												<Badge variant={ACTION_VARIANT[step.action]}>{step.action}</Badge>
												<span className="font-mono text-xs">{step.path}</span>
											</div>
											<p className="text-xs text-muted-foreground">{step.reason}</p>
										</li>
									))}
								</ul>
							</div>
						) : null}

						{plan !== null && plan.warnings.length > 0 && plan.canRollback ? (
							<div className="grid gap-1 text-xs text-muted-foreground">
								{plan.warnings.map((warning) => (
									<p key={warning}>{warning}</p>
								))}
							</div>
						) : null}
					</div>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
