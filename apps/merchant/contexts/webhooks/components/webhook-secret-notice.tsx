"use client";

import { Button } from "@workspace/ui/components/button";
import { CodeBlock, CodeBlockCopyButton, CodeBlockHeader, CodeBlockTitle } from "@workspace/ui/components/code-block";
import { ShieldAlert } from "lucide-react";
import * as React from "react";

export interface WebhookSecretNoticeProps {
	/** What happened: a new endpoint, or a rotated secret. */
	readonly heading: string;
	readonly secret: string;
	readonly onDismiss: () => void;
}

/** The one moment a signing secret is visible: the API never returns it again. Presentational. */
export function WebhookSecretNotice({ heading, secret, onDismiss }: WebhookSecretNoticeProps): React.JSX.Element {
	return (
		<section aria-labelledby="webhook-secret-heading" role="status" className="rounded-xl border border-warning/40 bg-warning-soft p-5">
			<div className="flex items-start gap-3">
				<span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning/15 text-warning">
					<ShieldAlert className="size-5" aria-hidden="true" />
				</span>
				<div className="min-w-0 flex-1">
					<h2 id="webhook-secret-heading" className="text-sm font-semibold text-foreground">
						{heading}
					</h2>
					<p className="mt-1 text-sm text-muted-foreground">
						Copy the signing secret now: it won&apos;t be shown again. Your server uses it to check that each request really came from us.
					</p>
					<CodeBlock code={secret} language="text" highlight={false} label="Signing secret" className="mt-4">
						<CodeBlockHeader>
							<CodeBlockTitle>Signing secret</CodeBlockTitle>
							<div className="ms-auto flex items-center gap-1">
								<CodeBlockCopyButton />
							</div>
						</CodeBlockHeader>
					</CodeBlock>
					<Button variant="outline" size="sm" className="mt-4" onClick={onDismiss}>
						I&apos;ve saved it
					</Button>
				</div>
			</div>
		</section>
	);
}
