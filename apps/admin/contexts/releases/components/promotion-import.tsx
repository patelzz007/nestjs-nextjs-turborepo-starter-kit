"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useAuthorization } from "@workspace/client/lib/contexts/authorization";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { useProgressRouter } from "@workspace/client/lib/navigation/use-progress-router";
import { PERMISSION, PromotionFileSchema, type PromotionFile, type PromotionPreview, type PromotedGroupChange } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { FieldError } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { StatusBadge, type StatusTone } from "@workspace/ui/components/status-badge";
import { toastMessage } from "@workspace/ui/components/toast";
import * as React from "react";
import { z } from "zod";

import { TextField, type FormFieldError } from "@/components/common/form-fields";
import { toastMutationError } from "@/lib/api/mutation-error";
import { ROUTES } from "@/lib/routes";

import { formatWhen } from "../lib/release-labels";
import { EnvironmentNote } from "./environment-note";
import { ReasonActionForm } from "./reason-action-form";
import { RulesSummary, type SummarisedRule } from "./rules-summary";

const RELEASES_SCOPE: readonly string[] = ["admin", "releases"];
/** The pasted text has no field-level checks: the comparison reports what's wrong with the whole file. */
const NO_ERRORS: readonly FormFieldError[] = [];

function noop(): void {
	// Nothing happens on leaving the pasted text: it is compared on request.
}

const GROUP_CHANGE_LABELS: Readonly<Record<PromotedGroupChange["change"], string>> = {
	NEW: "Will be created",
	CHANGED: "Its conditions will change",
	SAME: "Already the same here",
	LISTED_HERE: "A listed group here: left as it is",
};

const GROUP_CHANGE_TONES: Readonly<Record<PromotedGroupChange["change"], StatusTone>> = { NEW: "info", CHANGED: "warning", SAME: "muted", LISTED_HERE: "neutral" };

/** The pasted text as a promotion file, or why it isn't one. */
export function readPromotionFile(text: string): { readonly file: PromotionFile } | { readonly problem: string } {
	let json: z.output<typeof z.json>;
	try {
		json = z.json().parse(JSON.parse(text));
	} catch {
		return { problem: "This isn't JSON: paste the whole exported file." };
	}
	const parsed = PromotionFileSchema.safeParse(json);
	return parsed.success ? { file: parsed.data } : { problem: z.prettifyError(parsed.error) };
}

/** A revision's content as rules the summary reads (a config's rules also name their value). */
function rulesOf(content: PromotionPreview["incoming"]): readonly SummarisedRule[] {
	return content.rules;
}

/** `/releases/promotion` (ADR 087): import rules exported from another environment, after seeing what would change. */
export function PromotionImport(): React.JSX.Element {
	const { api } = useAuth();
	const { can } = useAuthorization();
	const queryClient = useQueryClient();
	const router = useProgressRouter();
	const [text, setText] = React.useState("");
	const [problem, setProblem] = React.useState<string | null>(null);
	const [file, setFile] = React.useState<PromotionFile | null>(null);
	const [preview, setPreview] = React.useState<PromotionPreview | null>(null);
	const canImport = can(PERMISSION.FEATURE_FLAG.UPDATE) && can(PERMISSION.DYNAMIC_CONFIG.UPDATE);
	const previewMutation = api.featureFlags.promotionPreview.useMutation({
		onSuccess: (response): void => {
			setPreview(response.data);
		},
		onError: (error): void => {
			toastMutationError("Could not compare the file", error);
		},
	});
	const importMutation = api.featureFlags.promotionImport.useMutation({
		onSuccess: async (response): Promise<void> => {
			toastMessage.success({
				title: `Revision ${String(response.data.number)} saved`,
				description: response.data.status === "PENDING" ? "It waits for a second person to approve it." : "It is live.",
			});
			await queryClient.invalidateQueries({ queryKey: RELEASES_SCOPE });
			router.push(file?.kind === "CONFIG" ? ROUTES.releases.config(file.key) : ROUTES.releases.flag(file?.key ?? ""));
		},
		onError: (error): void => {
			toastMutationError("Could not import the rules", error);
		},
	});
	const { mutate: requestPreview } = previewMutation;
	const { mutateAsync: importRules } = importMutation;
	const compare = React.useCallback(
		(source: string): void => {
			setText(source);
			setPreview(null);
			const read = readPromotionFile(source);
			if ("problem" in read) {
				setProblem(read.problem);
				setFile(null);
				return;
			}
			setProblem(null);
			setFile(read.file);
			requestPreview({ file: read.file });
		},
		[requestPreview],
	);
	const handleUpload = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			const [chosen] = event.target.files ?? [];
			if (chosen !== undefined) {
				void chosen.text().then(compare);
			}
		},
		[compare],
	);
	const compareText = React.useCallback((): void => {
		compare(text);
	}, [compare, text]);
	const submitImport = React.useCallback(
		async (reason: string): Promise<void> => {
			if (file !== null) {
				await importRules({ file, reason });
			}
		},
		[file, importRules],
	);
	// The moment the page opened: a scheduled rollout's share now is worked out from it.
	const [now] = React.useState(Date.now);
	return (
		<div className="flex flex-col gap-6">
			<header className="flex flex-col gap-1">
				<h1 className="text-2xl font-semibold tracking-tight">Rule promotion</h1>
				<p className="max-w-3xl text-sm text-muted-foreground">
					Bring a flag&apos;s or a config&apos;s rules from another environment. Export them there from the flag&apos;s page, then upload the file here: you see what would
					change before anything does.
				</p>
			</header>
			<EnvironmentNote />
			<Card>
				<CardHeader>
					<CardTitle>The exported file</CardTitle>
					<CardDescription>Only rules and the condition groups they name travel. Overrides, the kill switch and listed groups stay in their own environment.</CardDescription>
				</CardHeader>
				<CardContent className="flex max-w-3xl flex-col gap-4">
					<div className="space-y-1.5">
						<Label htmlFor="promotion-upload">Upload it</Label>
						<Input id="promotion-upload" type="file" accept="application/json,.json" onChange={handleUpload} />
					</div>
					<TextField id="promotion-text" label="Or paste it" multiline value={text} onChange={setText} onBlur={noop} errors={NO_ERRORS} />
					{problem === null ? null : <FieldError errors={[{ message: problem }]} />}
					<div>
						<Button type="button" variant="outline" disabled={text.trim() === "" || previewMutation.isPending} onClick={compareText}>
							Compare with this environment
						</Button>
					</div>
				</CardContent>
			</Card>
			{file === null || preview === null ? null : (
				<Card>
					<CardHeader>
						<CardTitle>{`${preview.kind === "FLAG" ? "Feature flag" : "Dynamic config"} ${preview.key}`}</CardTitle>
						<CardDescription>{`Revision ${String(file.revision)} from ${preview.from}, exported ${formatWhen(file.exportedAt)}, into ${preview.to}.`}</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col gap-6">
						<div className="grid gap-6 lg:grid-cols-2">
							<section className="flex flex-col gap-2">
								<h3 className="text-sm font-medium">
									{preview.current === null ? "Here now: nothing (the code default)" : `Here now: revision ${String(preview.current.number)}`}
								</h3>
								{preview.current === null ? null : <RulesSummary rules={rulesOf(preview.current.content)} fallback="the code default" now={now} />}
							</section>
							<section className="flex flex-col gap-2">
								<h3 className="text-sm font-medium">After the import</h3>
								<RulesSummary rules={rulesOf(preview.incoming)} fallback="the code default" now={now} />
							</section>
						</div>
						{preview.groups.length === 0 ? null : (
							<section className="flex flex-col gap-2">
								<h3 className="text-sm font-medium">Flag groups the rules name</h3>
								<ul className="flex flex-col gap-1 text-sm">
									{preview.groups.map((group): React.JSX.Element => (
										<li key={group.key} className="flex flex-wrap items-center gap-2">
											<span className="font-mono text-xs">{group.key}</span>
											<StatusBadge tone={GROUP_CHANGE_TONES[group.change]}>{GROUP_CHANGE_LABELS[group.change]}</StatusBadge>
										</li>
									))}
								</ul>
							</section>
						)}
						{preview.missingListedGroups.length === 0 ? null : (
							<FieldError errors={[{ message: `Create these listed groups here first: ${preview.missingListedGroups.join(", ")}.` }]} />
						)}
						{preview.identical ? (
							<p className="text-sm text-muted-foreground">The rules here are already the same: there is nothing to import.</p>
						) : canImport && preview.missingListedGroups.length === 0 ? (
							<ReasonActionForm
								id="promotion-import"
								label={preview.needsApproval ? "Why import them (a second person approves it here)" : "Why import them"}
								submitLabel="Import the rules"
								placeholder="e.g. Tested in staging for a week"
								pending={importMutation.isPending}
								onSubmit={submitImport}
							/>
						) : null}
					</CardContent>
				</Card>
			)}
		</div>
	);
}
