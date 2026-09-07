"use client";

import type { PlanAction, WizardResourceInput } from "@workspace/cli/generator";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { Spinner } from "@workspace/ui/components/feedback/spinner";
import { Button } from "@workspace/ui/components/form/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@workspace/ui/components/overlay/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/display/table";
import { Eye } from "lucide-react";
import * as React from "react";

import { fetchGenerationPlanDiffAction } from "@/lib/generator/actions";
import { cn } from "@/lib/utils";

const ACTION_VARIANT: Record<PlanAction["action"], "default" | "secondary" | "outline" | "destructive"> = {
	create: "default",
	modify: "secondary",
	skip: "outline",
	conflict: "destructive",
};

function buildUnifiedDiff(before: string, after: string): string {
	const beforeLines = before.split("\n");
	const afterLines = after.split("\n");
	const maxLines = Math.max(beforeLines.length, afterLines.length);
	const lines: string[] = [];

	for (let index = 0; index < maxLines; index += 1) {
		const beforeLine = beforeLines[index];
		const afterLine = afterLines[index];
		if (beforeLine === afterLine) {
			if (beforeLine !== undefined) {
				lines.push(` ${beforeLine}`);
			}
			continue;
		}
		if (beforeLine !== undefined) {
			lines.push(`-${beforeLine}`);
		}
		if (afterLine !== undefined) {
			lines.push(`+${afterLine}`);
		}
	}

	return lines.join("\n");
}

export interface GenerationPlanTableProps {
	readonly actions: readonly PlanAction[];
	readonly wizardInput: WizardResourceInput | null;
}

export const GenerationPlanTable = React.memo(function GenerationPlanTable({ actions, wizardInput }: GenerationPlanTableProps): React.JSX.Element {
	const grouped: Record<PlanAction["action"], PlanAction[]> = {
		create: [],
		modify: [],
		skip: [],
		conflict: [],
	};
	for (const action of actions) {
		grouped[action.action].push(action);
	}

	const order: PlanAction["action"][] = ["create", "modify", "skip", "conflict"];
	const [diffPath, setDiffPath] = React.useState<string | null>(null);
	const [diffContent, setDiffContent] = React.useState<string | null>(null);
	const [diffLoading, setDiffLoading] = React.useState(false);
	const [diffError, setDiffError] = React.useState<string | null>(null);

	const handlePreviewDiff = (filePath: string): void => {
		if (wizardInput === null) {
			return;
		}
		setDiffPath(filePath);
		setDiffLoading(true);
		setDiffError(null);
		setDiffContent(null);
		void (async (): Promise<void> => {
			try {
				const diff = await fetchGenerationPlanDiffAction(wizardInput, filePath);
				setDiffContent(buildUnifiedDiff(diff.before, diff.after));
			} catch (error) {
				const message = error instanceof Error ? error.message : "Failed to load diff.";
				setDiffError(message);
			} finally {
				setDiffLoading(false);
			}
		})();
	};

	const handleDiffOpenChange = (open: boolean): void => {
		if (!open) {
			setDiffPath(null);
			setDiffContent(null);
			setDiffError(null);
		}
	};

	return (
		<>
			<div className="overflow-hidden rounded-xl border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="w-28">Action</TableHead>
							<TableHead>Path</TableHead>
							<TableHead className="hidden lg:table-cell">Reason</TableHead>
							<TableHead className="w-24 text-right">Diff</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{order.flatMap((actionType) =>
							grouped[actionType].map((action) => (
								<TableRow key={`${action.action}-${action.path}`}>
									<TableCell>
										<Badge variant={ACTION_VARIANT[action.action]}>{action.action}</Badge>
									</TableCell>
									<TableCell className="font-mono text-xs">{action.path}</TableCell>
									<TableCell className={cn("hidden text-xs text-muted-foreground lg:table-cell")}>{action.reason}</TableCell>
									<TableCell className="text-right">
										{action.action === "modify" ? (
											<Button
												type="button"
												variant="ghost"
												size="icon-xs"
												aria-label={`Preview diff for ${action.path}`}
												disabled={wizardInput === null}
												onClick={() => {
													handlePreviewDiff(action.path);
												}}>
												<Eye className="size-4" />
											</Button>
										) : null}
									</TableCell>
								</TableRow>
							)),
						)}
					</TableBody>
				</Table>
			</div>

			<Dialog open={diffPath !== null} onOpenChange={handleDiffOpenChange}>
				<DialogContent className="max-w-4xl">
					<DialogHeader>
						<DialogTitle>Diff preview</DialogTitle>
						<DialogDescription className="font-mono text-xs">{diffPath}</DialogDescription>
					</DialogHeader>
					{diffLoading ? (
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							<Spinner className="size-4" />
							Loading diff…
						</div>
					) : null}
					{diffError !== null ? <p className="text-sm text-destructive">{diffError}</p> : null}
					{diffContent !== null ? (
						<pre className="max-h-[32rem] overflow-auto rounded-lg bg-muted p-4 text-xs leading-relaxed">{diffContent}</pre>
					) : null}
				</DialogContent>
			</Dialog>
		</>
	);
});

GenerationPlanTable.displayName = "GenerationPlanTable";
