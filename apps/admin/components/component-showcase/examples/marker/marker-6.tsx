"use client";

import * as React from "react";
import { CheckIcon, FileTextIcon, GitMergeIcon, RotateCcwIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { Marker, MarkerContent, MarkerIcon } from "@workspace/ui/components/marker";

// render REPLACES the row rather than wrapping it, so the marker's own classes
// land on the anchor and the primitive's link treatment comes for free. A
// button gets no such treatment, which is why only the button carries a hover.
//
// The button toggles real state and the row rewrites itself, because a control
// that only looks clickable is a decorative control. That is the one reason
// this file is a client component.
//
// The icon swap is two complete elements behind a ternary instead of one
// element with a computed name, because every library prop has to stay a
// literal string for the registry installer to rewrite it.
// The two links point back at the gallery's Marker section; each names itself
// with the same words its content shows.
const PULL_REQUEST_LINK: React.JSX.Element = <a href="#component-marker" aria-label="Review pull request #412" />;
const DIFF_LINK: React.JSX.Element = <a href="#component-marker" aria-label="Open the diff for rate-limit.ts" />;

export function Marker6Example(): React.JSX.Element {
	const [reverted, setReverted] = useState(false);
	const toggleReverted = useCallback((): void => {
		setReverted((value: boolean): boolean => !value);
	}, []);

	return (
		<div className="mx-auto flex w-full max-w-sm flex-col gap-4">
			<Marker render={PULL_REQUEST_LINK}>
				<MarkerIcon>
					<GitMergeIcon />
				</MarkerIcon>
				<MarkerContent>Review pull request #412</MarkerContent>
			</Marker>
			<Marker render={DIFF_LINK}>
				<MarkerIcon>
					<FileTextIcon />
				</MarkerIcon>
				<MarkerContent>Open the diff for rate-limit.ts</MarkerContent>
			</Marker>
			<Marker render={<button type="button" className="transition-colors hover:text-foreground" onClick={toggleReverted} />}>
				<MarkerIcon>{reverted ? <CheckIcon /> : <RotateCcwIcon />}</MarkerIcon>
				<MarkerContent>{reverted ? "Undo the revert" : "Revert this change"}</MarkerContent>
			</Marker>
			{/* Mounted empty from the first render, not inserted on the click: a
          live region added at the same moment as its text is not reliably
          announced, and the button's own label changes silently. */}
			<span role="status" aria-live="polite" className="sr-only">
				{reverted ? "Change reverted" : ""}
			</span>
		</div>
	);
}
