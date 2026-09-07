"use client";

import type { ResourceGeneratorApplyResult, ResourceGeneratorPreview, WizardResourceInput } from "@workspace/cli/generator";
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/feedback/alert";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { Button } from "@workspace/ui/components/form/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { Spinner } from "@workspace/ui/components/feedback/spinner";
import { CheckCircle2, Terminal } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { GenerationPlanTable } from "@/components/generator/generation-plan-table";

export interface GeneratorGenerateStepProps {
	readonly preview: ResourceGeneratorPreview | null;
	readonly wizardInput: WizardResourceInput | null;
	readonly applyResult: ResourceGeneratorApplyResult | null;
	readonly applying: boolean;
	readonly error: string | null;
	readonly onApply: () => void;
}

export const GeneratorGenerateStep = React.memo(function GeneratorGenerateStep({
	preview,
	wizardInput,
	applyResult,
	applying,
	error,
	onApply,
}: GeneratorGenerateStepProps): React.JSX.Element {
	if (preview === null) {
		return (
			<Card>
				<CardContent className="py-8">
					<p className="text-sm text-muted-foreground">Preview the definition first to see the generation plan.</p>
				</CardContent>
			</Card>
		);
	}

	const canApply = !preview.definitionExists && preview.actionCounts.conflict === 0 && !applying;
	const hasPartialFailure = applyResult !== null && !applyResult.success && applyResult.writtenFiles.length > 0;

	return (
		<div className="grid gap-6">
			<Card>
				<CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
					<div>
						<CardTitle>Generation plan</CardTitle>
						<CardDescription>Review files that will be created or updated before applying.</CardDescription>
					</div>
					<div className="flex flex-wrap gap-2">
						<Badge>{String(preview.actionCounts.create)} new</Badge>
						<Badge variant="secondary">{String(preview.actionCounts.modify)} update</Badge>
						<Badge variant="outline">{String(preview.actionCounts.skip)} skip</Badge>
						{preview.actionCounts.conflict > 0 ? <Badge variant="destructive">{String(preview.actionCounts.conflict)} conflict</Badge> : null}
					</div>
				</CardHeader>
				<CardContent className="grid gap-4">
					<GenerationPlanTable actions={preview.actions} wizardInput={wizardInput} />

					{preview.definitionExists ? (
						<Alert variant="destructive">
							<AlertTitle>Definition already exists</AlertTitle>
							<AlertDescription>{preview.definitionPath} is already on disk. Choose a different resource name or delete the existing definition first.</AlertDescription>
						</Alert>
					) : null}

					{error !== null ? (
						<Alert variant="destructive">
							<AlertTitle>Generation failed</AlertTitle>
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					) : null}

					{hasPartialFailure ? (
						<Alert variant="destructive">
							<AlertTitle>Partial generation</AlertTitle>
							<AlertDescription className="grid gap-2">
								<p>
									{String(applyResult.writtenFiles.length)} file(s) were written before the pipeline failed. Review validation output, fix issues, then retry apply or roll back from the
									generator hub.
								</p>
								<p className="font-mono text-xs">{applyResult.writtenFiles.join(", ")}</p>
							</AlertDescription>
						</Alert>
					) : null}

					{applyResult?.success === true ? (
						<Alert>
							<CheckCircle2 className="size-4" />
							<AlertTitle>Generation complete</AlertTitle>
							<AlertDescription className="grid gap-2">
								<p>
									Wrote {String(applyResult.writtenFiles.length)} file(s). Skipped {String(applyResult.skippedFiles.length)} developer-owned scaffold(s).
								</p>
								<p className="text-sm">
									Next: run <code className="rounded bg-muted px-1 py-0.5">pnpm db:migrate</code> then open the new admin route.
								</p>
								<Button type="button" variant="outline" size="sm" className="w-fit" nativeButton={false} render={<Link href={`/${applyResult.slug}`} />}>
									Open /{applyResult.slug}
								</Button>
							</AlertDescription>
						</Alert>
					) : null}

					<div className="flex flex-wrap gap-2">
						<Button type="button" onClick={onApply} disabled={!canApply || applying}>
							{applying ? (
								<>
									<Spinner className="size-4" />
									Applying…
								</>
							) : applyResult !== null && !applyResult.success ? (
								"Retry generation"
							) : (
								"Apply generation"
							)}
						</Button>
					</div>
				</CardContent>
			</Card>

			{applyResult !== null && applyResult.validationSteps.length > 0 ? (
				<Card>
					<CardHeader>
						<CardTitle>Validation pipeline</CardTitle>
						<CardDescription>Format, lint, and typecheck run automatically after generation.</CardDescription>
					</CardHeader>
					<CardContent className="grid gap-3">
						{applyResult.validationSteps.map((step) => (
							<div key={step.label} className="rounded-xl border px-4 py-3">
								<div className="flex items-center gap-2">
									{step.success ? <CheckCircle2 className="size-4 text-primary" /> : <Terminal className="size-4 text-destructive" />}
									<p className="text-sm font-medium">{step.label}</p>
									<Badge variant={step.success ? "secondary" : "destructive"}>{step.success ? "passed" : "failed"}</Badge>
								</div>
								{!step.success && step.output.length > 0 ? <pre className="mt-3 max-h-48 overflow-auto rounded-lg bg-muted p-3 text-xs">{step.output}</pre> : null}
							</div>
						))}
					</CardContent>
				</Card>
			) : null}
		</div>
	);
});

GeneratorGenerateStep.displayName = "GeneratorGenerateStep";
