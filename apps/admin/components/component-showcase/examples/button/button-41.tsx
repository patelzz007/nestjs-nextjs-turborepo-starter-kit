"use client";

import * as React from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useCopyToClipboard } from "@workspace/ui/hooks/use-copy-to-clipboard";
import { Button } from "@workspace/ui/components/button";

/** How long the "Copied" state shows after a copy. */
const COPIED_FEEDBACK_MS = 1500;
const SAMPLE_LINK = "https://example.com/invite/team";

export function Button41Example(): React.JSX.Element {
	const { isCopied, copyToClipboard } = useCopyToClipboard({ timeout: COPIED_FEEDBACK_MS });
	const handleCopy = React.useCallback((): void => {
		copyToClipboard(SAMPLE_LINK);
	}, [copyToClipboard]);

	return (
		<Button variant="outline" aria-label={isCopied ? "Copied" : "Copy"} onClick={handleCopy}>
			{isCopied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
			<span>{isCopied ? "Copied" : "Copy"}</span>
		</Button>
	);
}
