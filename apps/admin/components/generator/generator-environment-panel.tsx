"use client";

import type { GeneratorDoctorResult, GeneratorUiModuleListItem, InitGeneratorModulesResult } from "@workspace/cli/generator";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { Spinner } from "@workspace/ui/components/feedback/spinner";
import { toastMessage } from "@workspace/ui/components/feedback/toast";
import { Button } from "@workspace/ui/components/form/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { CheckCircle2, RefreshCw, Stethoscope, XCircle } from "lucide-react";
import * as React from "react";

import { runGeneratorDoctorAction, runInitGeneratorModulesAction } from "@/lib/generator/actions";

export interface GeneratorEnvironmentPanelProps {
	readonly initialModules: readonly GeneratorUiModuleListItem[];
}

export function GeneratorEnvironmentPanel({ initialModules }: GeneratorEnvironmentPanelProps): React.JSX.Element {
	const [modules, setModules] = React.useState<readonly GeneratorUiModuleListItem[]>(initialModules);
	const [doctorResult, setDoctorResult] = React.useState<GeneratorDoctorResult | null>(null);
	const [initResult, setInitResult] = React.useState<InitGeneratorModulesResult | null>(null);
	const [doctorLoading, setDoctorLoading] = React.useState(false);
	const [initLoading, setInitLoading] = React.useState(false);

	const handleDoctor = (): void => {
		void (async (): Promise<void> => {
			setDoctorLoading(true);
			try {
				const result = await runGeneratorDoctorAction();
				setDoctorResult(result);
				if (result.success) {
					toastMessage.success({ title: "Doctor passed", description: "Generator environment looks ready." });
				} else {
					toastMessage.error({ title: "Doctor found issues", description: "Review the failed checks below." });
				}
			} catch (error) {
				const message = error instanceof Error ? error.message : "Doctor failed.";
				toastMessage.error({ title: "Doctor failed", description: message });
			} finally {
				setDoctorLoading(false);
			}
		})();
	};

	const handleInitModules = (): void => {
		void (async (): Promise<void> => {
			setInitLoading(true);
			try {
				const result = await runInitGeneratorModulesAction();
				setInitResult(result);
				if (!result.success) {
					toastMessage.error({ title: "Init modules failed", description: result.error ?? "No modules discovered." });
					return;
				}
				setModules(result.modules);
				toastMessage.success({
					title: "UI modules refreshed",
					description: `Wrote ${String(result.modules.length)} module(s) to ${result.manifestPath}.`,
				});
			} catch (error) {
				const message = error instanceof Error ? error.message : "Init modules failed.";
				toastMessage.error({ title: "Init modules failed", description: message });
			} finally {
				setInitLoading(false);
			}
		})();
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>Environment</CardTitle>
				<CardDescription>Run the same checks as the CLI without leaving the browser.</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-6">
				<div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
					<Button type="button" variant="outline" onClick={handleDoctor} disabled={doctorLoading || initLoading}>
						{doctorLoading ? <Spinner className="size-4" /> : <Stethoscope className="size-4" aria-hidden="true" />}
						Run doctor
						<span className="font-mono text-xs text-muted-foreground">pnpm app doctor</span>
					</Button>
					<Button type="button" variant="outline" onClick={handleInitModules} disabled={doctorLoading || initLoading}>
						{initLoading ? <Spinner className="size-4" /> : <RefreshCw className="size-4" aria-hidden="true" />}
						Refresh UI modules
						<span className="font-mono text-xs text-muted-foreground">pnpm app init-modules</span>
					</Button>
				</div>

				<div className="grid gap-3">
					<p className="text-sm font-medium">Detected UI modules</p>
					{modules.length === 0 ? (
						<p className="text-sm text-muted-foreground">No modules in manifest yet. Run refresh to scan apps/*.</p>
					) : (
						<div className="flex flex-wrap gap-2">
							{modules.map((module) => (
								<Badge key={module.id} variant="secondary">
									{module.id}
								</Badge>
							))}
						</div>
					)}
					{initResult?.success ? <p className="text-xs text-muted-foreground">Updated {initResult.manifestPath}</p> : null}
				</div>

				{doctorResult !== null ? (
					<div className="grid gap-2 rounded-xl border p-4">
						<div className="flex items-center gap-2">
							{doctorResult.success ? <CheckCircle2 className="size-4 text-primary" aria-hidden="true" /> : <XCircle className="size-4 text-destructive" aria-hidden="true" />}
							<p className="text-sm font-medium">{doctorResult.success ? "All checks passed" : "Some checks failed"}</p>
						</div>
						<ul className="grid gap-2">
							{doctorResult.checks.map((check) => (
								<li key={check.label} className="grid gap-0.5 text-sm">
									<div className="flex items-center gap-2">
										{check.ok ? (
											<CheckCircle2 className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
										) : (
											<XCircle className="size-3.5 shrink-0 text-destructive" aria-hidden="true" />
										)}
										<span>{check.label}</span>
									</div>
									<p className="pl-5 font-mono text-xs text-muted-foreground">{check.detail}</p>
								</li>
							))}
						</ul>
					</div>
				) : null}
			</CardContent>
		</Card>
	);
}
