"use client";

import { Skeleton } from "@workspace/ui/components/skeleton";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import { cn } from "@workspace/ui/lib/core/utils";
import { diagramThemeStyle } from "@workspace/ui/lib/diagram/diagram-theme";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import { mountAsync, type Mounted, type MountOptions } from "pele/lazy";
import * as React from "react";

/** The `diagram` family of `UiKitLabels`. */
export interface DiagramLabels {
	/** Announced while the renderer loads, e.g. "Loading diagram…". */
	readonly loading: string;
	/** Accessible names of the zoom controls a diagram shows when it is drawn smaller than its natural size. */
	readonly zoomIn: string;
	readonly zoomOut: string;
	readonly resetZoom: string;
}

export interface DiagramProps extends Omit<React.ComponentProps<"figure">, "children"> {
	/**
	 * The diagram in Mermaid syntax (every Mermaid 12 diagram type). Give it an accessible
	 * name with `accTitle:` and a summary with `accDescr:` — the SVG carries both.
	 * Rendered with Pele's escaping and link filtering; pass trusted sources.
	 */
	readonly source: string;
	/** A visible caption under the diagram. */
	readonly caption?: React.ReactNode;
	/** Overrides the `diagram` strings, such as the error shown for invalid source. */
	readonly labels?: UiKitLabelsOverride<"diagram"> | undefined;
}

type DiagramStatus = "loading" | "ready" | "error";

const THEME_STYLE = diagramThemeStyle();

/** `useId` output ("_r_1_") made safe for the SVG's element ids. */
function svgIdPrefix(reactId: string): string {
	return `diagram-${reactId.replace(/[^\w-]/gu, "")}`;
}

/**
 * A Mermaid-syntax diagram drawn by Pele (https://pele.run) as themed SVG: colours,
 * radius and fonts come from the design tokens (lib/ui/diagram/diagram-theme.ts), so
 * it follows light / dark / Nord without a re-render. Each diagram type's renderer
 * loads on demand; the layout adapts to the container width (a wide flowchart turns
 * vertical on a phone) and an oversized diagram gets zoom controls. A syntax error
 * is drawn in place of the diagram.
 */
export const Diagram = React.forwardRef<HTMLElement, DiagramProps>(function Diagram(
	{ source, caption, labels: labelsOverride, className, style, ...props },
	ref,
): React.JSX.Element {
	const labels = useUiKitLabels("diagram", labelsOverride);
	const canvasRef = React.useRef<HTMLDivElement>(null);
	const idPrefix = svgIdPrefix(React.useId());
	const [status, setStatus] = React.useState<DiagramStatus>("loading");
	const { zoomIn, zoomOut, resetZoom } = labels;

	React.useEffect((): (() => void) => {
		const canvas = canvasRef.current;
		let active = true;
		let mounted: Mounted | undefined;
		if (canvas !== null) {
			const options: MountOptions = {
				idPrefix,
				zoom: { labels: { zoomIn, zoomOut, reset: resetZoom } },
				onRender: (): void => {
					setStatus("ready");
				},
				onError: (): void => {
					setStatus("error");
				},
			};
			mountAsync(canvas, source, options).then(
				(result: Mounted): void => {
					if (!active) {
						result.destroy();
						return;
					}
					mounted = result;
					// Labels are measured with the CSS font; measure again once web fonts have loaded.
					void document.fonts.ready.then((): void => {
						if (active) {
							result.refresh();
						}
					});
				},
				(): void => {
					if (active) {
						setStatus("error");
					}
				},
			);
		}
		return (): void => {
			active = false;
			mounted?.destroy();
		};
	}, [idPrefix, resetZoom, source, zoomIn, zoomOut]);

	return (
		<figure ref={ref} data-slot="diagram" data-status={status} className={cn("flex flex-col gap-3", className)} style={{ ...THEME_STYLE, ...style }} {...props}>
			<div className="relative overflow-hidden rounded-xl border border-border bg-card p-4 sm:p-6">
				{status === "loading" ? (
					<SkeletonRegion labels={{ loading: labels.loading }} className="absolute inset-4 flex sm:inset-6">
						<Skeleton className="size-full" />
					</SkeletonRegion>
				) : null}
				{/* Pele owns this element's children: React never renders into it. */}
				<div ref={canvasRef} data-slot="diagram-canvas" className={cn("flex min-h-24 justify-center", status === "loading" && "invisible min-h-48")} />
			</div>
			{caption !== undefined ? (
				<figcaption data-slot="diagram-caption" className="text-center text-sm text-muted-foreground">
					{caption}
				</figcaption>
			) : null}
		</figure>
	);
});
Diagram.displayName = "Diagram";
