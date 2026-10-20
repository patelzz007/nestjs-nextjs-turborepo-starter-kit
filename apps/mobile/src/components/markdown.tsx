// Markdown — a pull request description or comment, drawn the way GitHub's
// app draws it (components/markdown-body.tsx). This is the public entry: it
// loads the body lazily, the first time a body is drawn, so `marked` (the
// parser) and the body's drawing code are evaluated on first use, never at the
// app's start (docs/architecture/ddd-cqrs-migration-plan.md §19.5). Until the
// body has loaded, a few lines of skeleton hold its place.

import { SkeletonGroup, SkeletonText } from "@workspace/ui-native/components/skeleton";
import * as React from "react";

import { lazyView } from "../lib/lazy-view";
import type { MarkdownProps } from "./markdown-body";

export type { MarkdownImageLoader, MarkdownProps } from "./markdown-body";

/** The lines of text a body is drawn over while it loads. */
export function MarkdownSkeleton(): React.JSX.Element {
	return (
		<SkeletonGroup accessibilityLabel="Loading the text" testID="markdown-skeleton" className="gap-1">
			<SkeletonText size="base" widthClassName="w-full" />
			<SkeletonText size="base" widthClassName="w-5/6" />
			<SkeletonText size="base" widthClassName="w-2/3" />
		</SkeletonGroup>
	);
}

/** A pull request description or comment; the body (and `marked`) loads the first time one is drawn. */
export const Markdown = lazyView<MarkdownProps>(async (): Promise<React.ComponentType<MarkdownProps>> => (await import("./markdown-body")).MarkdownBody, MarkdownSkeleton);
