"use client";

import type { ResourceGeneratorPreview } from "@workspace/cli/generator";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { Spinner } from "@workspace/ui/components/feedback/spinner";
import * as React from "react";

import { CodeBlock } from "@/components/docs/code-block";

export interface GeneratorPreviewStepProps {
	readonly preview: ResourceGeneratorPreview | null;
	readonly loading: boolean;
	readonly error: string | null;
}

export const GeneratorPreviewStep = React.memo(function GeneratorPreviewStep({ preview, loading, error }: GeneratorPreviewStepProps): React.JSX.Element {
	if (loading) {
		return (
			<Card>
				<CardContent className="flex items-center justify-center gap-3 py-16">
					<Spinner />
					<p className="text-sm text-muted-foreground">Building definition preview…</p>
				</CardContent>
			</Card>
		);
	}

	if (error !== null) {
		return (
			<Card>
				<CardContent className="py-8">
					<p className="text-sm text-destructive">{error}</p>
				</CardContent>
			</Card>
		);
	}

	if (preview === null) {
		return (
			<Card>
				<CardContent className="py-8">
					<p className="text-sm text-muted-foreground">Complete the previous steps to preview the definition.</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="grid gap-6">
			<Card>
				<CardHeader>
					<CardTitle>Resource summary</CardTitle>
					<CardDescription>Normalized IR details before writing files.</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-wrap gap-2">
					<Badge variant="secondary">{preview.summary.name}</Badge>
					<Badge variant="outline">slug: {preview.summary.slug}</Badge>
					<Badge variant="outline">RLS: {preview.summary.rls}</Badge>
					<Badge variant="outline">{String(preview.summary.fieldCount)} fields</Badge>
					{preview.summary.relationCount > 0 ? <Badge variant="outline">{String(preview.summary.relationCount)} relations</Badge> : null}
					{preview.definitionExists ? <Badge variant="destructive">Definition already exists</Badge> : null}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Definition file</CardTitle>
					<CardDescription>{preview.definitionPath}</CardDescription>
				</CardHeader>
				<CardContent>
					<CodeBlock code={preview.definitionSource} language="typescript" fileName={`${preview.summary.slug}.resource.ts`} showLineNumbers />
				</CardContent>
			</Card>
		</div>
	);
});

GeneratorPreviewStep.displayName = "GeneratorPreviewStep";
