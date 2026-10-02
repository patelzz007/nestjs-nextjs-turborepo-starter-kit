"use client";

import { posEndpointUrl } from "@/lib/pos/pos-endpoint-url";
import { CodeBlock, CodeBlockCopyButton, CodeBlockHeader, CodeBlockLanguage, CodeBlockTitle, DEFAULT_CODE_BLOCK_LABELS } from "@workspace/ui/components/display/code-block";
import { apiRoutes } from "@workspace/shared";
import * as React from "react";

/** Shown in the guide, where no code has been issued yet. */
export const PAIRING_CODE_PLACEHOLDER = "<pairing code>";

/** Snippet header: the route the till calls (no `X-API-Key` — pairing is how the till gets one). */
export const PAIR_TERMINAL_SNIPPET_TITLE = `POST ${apiRoutes.pos.pairTerminal}`;

/** The till's one pairing call: `POST /pos/terminals/pair` with the code — the answer carries the till's own API key. */
export function buildPairTerminalSnippet(apiBaseUrl: string, pairingCode: string = PAIRING_CODE_PLACEHOLDER): string {
	return [
		`curl -X POST ${posEndpointUrl(apiBaseUrl, apiRoutes.pos.pairTerminal)} \\`,
		`  -H "Content-Type: application/json" \\`,
		`  -d '${JSON.stringify({ pairingCode })}'`,
	].join("\n");
}

export interface PairTerminalSnippetProps {
	/** The API's public origin (e.g. `https://api.example.com`). */
	readonly apiBaseUrl: string;
	/** The live code, when one was just issued; the guide shows a placeholder instead. */
	readonly pairingCode?: string;
	readonly className?: string;
}

/** Copyable `curl` for the pairing call. Presentational. */
export function PairTerminalSnippet({ apiBaseUrl, pairingCode, className }: PairTerminalSnippetProps): React.JSX.Element {
	const code = React.useMemo((): string => buildPairTerminalSnippet(apiBaseUrl, pairingCode), [apiBaseUrl, pairingCode]);

	return (
		<CodeBlock code={code} language="bash" labels={DEFAULT_CODE_BLOCK_LABELS} label={PAIR_TERMINAL_SNIPPET_TITLE} className={className}>
			<CodeBlockHeader>
				<CodeBlockTitle>{PAIR_TERMINAL_SNIPPET_TITLE}</CodeBlockTitle>
				<CodeBlockLanguage>bash</CodeBlockLanguage>
				<div className="ms-auto flex items-center gap-1">
					<CodeBlockCopyButton />
				</div>
			</CodeBlockHeader>
		</CodeBlock>
	);
}
