"use client";

import type { EmailPreview } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import * as React from "react";

export interface EmailPreviewCardProps {
	readonly preview?: EmailPreview;
	readonly isLoading?: boolean;
	readonly footerNote?: string;
	readonly templatesHref?: string;
}

/** Dumb email preview card — iframe render of API-provided HTML. */
export default function EmailPreviewCard({ preview, isLoading = false, footerNote, templatesHref = "/emails?key=merchant-invite" }: EmailPreviewCardProps): React.JSX.Element {
	return (
		<Card className="h-full">
			<CardHeader className="pb-3">
				<div className="flex flex-wrap items-center gap-2">
					<CardTitle className="text-base">Email preview</CardTitle>
					{preview !== undefined ? (
						<Badge variant="outline" className="font-mono text-[10px]">
							{preview.key}
						</Badge>
					) : null}
				</div>
				<CardDescription>
					Review the message before sending.{" "}
					<Link href={templatesHref} className="text-primary hover:underline">
						Open in Email Templates
					</Link>
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-3">
				{isLoading ? (
					<div className="flex min-h-[280px] items-center justify-center text-muted-foreground">
						<Loader2 className="size-5 animate-spin" />
					</div>
				) : preview === undefined ? (
					<p className="text-sm text-muted-foreground">Fill the form and click Preview email to see the invite here.</p>
				) : (
					<>
						<p className="text-xs text-muted-foreground">
							To: <span className="text-foreground">{preview.to}</span> · Subject: <span className="text-foreground">{preview.subject}</span>
						</p>
						<iframe title={`${preview.label} preview`} srcDoc={preview.html} sandbox="" className="h-80 w-full rounded-lg border bg-background" />
						{footerNote !== undefined ? <p className="text-xs text-muted-foreground">{footerNote}</p> : null}
					</>
				)}
			</CardContent>
		</Card>
	);
}
