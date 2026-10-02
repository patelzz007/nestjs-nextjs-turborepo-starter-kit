"use client";

import { Button } from "@workspace/ui/components/form/button";
import { CodeBlock, CodeBlockCopyButton, CodeBlockHeader, CodeBlockTitle, DEFAULT_CODE_BLOCK_LABELS } from "@workspace/ui/components/display/code-block";
import { ShieldAlert } from "lucide-react";
import * as React from "react";

export interface CreatedApiKeyNoticeProps {
	readonly keyName: string;
	readonly secret: string;
	readonly onDismiss: () => void;
}

/**
 * The one moment a new key's secret is visible — the API never returns it
 * again. Copy affordance + an explicit "saved it" dismissal. Presentational.
 */
export function CreatedApiKeyNotice({ keyName, secret, onDismiss }: CreatedApiKeyNoticeProps): React.JSX.Element {
	return (
		<section aria-labelledby="created-api-key-heading" role="status" className="rounded-xl border border-warning/40 bg-warning-soft p-5 shadow-xs">
			<div className="flex items-start gap-3">
				<span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning/15 text-warning">
					<ShieldAlert className="size-5" aria-hidden="true" />
				</span>
				<div className="min-w-0 flex-1">
					<h2 id="created-api-key-heading" className="text-sm font-semibold text-foreground">
						Copy “{keyName}” now — it won&apos;t be shown again
					</h2>
					<p className="mt-1 text-sm text-muted-foreground">Store it in the terminal&apos;s configuration. If it&apos;s lost, revoke it and create a new one.</p>
					<CodeBlock code={secret} language="text" highlight={false} labels={DEFAULT_CODE_BLOCK_LABELS} label="New API key" className="mt-4">
						<CodeBlockHeader>
							<CodeBlockTitle>API key</CodeBlockTitle>
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
