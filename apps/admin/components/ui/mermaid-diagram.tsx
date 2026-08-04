"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * MermaidDiagram — renders a mermaid diagram source string to SVG.
 *
 * The heavy `mermaid` library is **dynamic-imported** inside the effect, so it
 * is code-split into its own chunk and only ever loaded when a real ```mermaid
 * block appears on screen. State is only ever updated in async callbacks (never
 * synchronously inside the effect body — `react-hooks/set-state-in-effect`).
 */

export interface MermaidDiagramProps {
	readonly chart: string;
	readonly className?: string;
}

interface MermaidResult {
	readonly chart: string;
	readonly svg: string;
}

let renderCounter = 0;

export function MermaidDiagram({ chart, className }: MermaidDiagramProps): React.JSX.Element {
	const [result, setResult] = React.useState<MermaidResult | null>(null);
	const [failed, setFailed] = React.useState(false);

	React.useEffect(() => {
		let cancelled = false;
		renderCounter += 1;
		const elementId = `mermaid-${String(renderCounter)}`;
		const isDark = document.documentElement.classList.contains("dark");

		const render = async (): Promise<void> => {
			try {
				const mermaid = (await import("mermaid")).default;
				mermaid.initialize({ startOnLoad: false, theme: isDark ? "dark" : "default", securityLevel: "strict" });
				const rendered = await mermaid.render(elementId, chart);
				if (!cancelled) {
					setResult({ chart, svg: rendered.svg });
				}
			} catch {
				if (!cancelled) {
					setFailed(true);
				}
			}
		};
		void render();

		return (): void => {
			cancelled = true;
		};
	}, [chart]);

	// Show the loading placeholder while the current chart is still rendering
	// (or once it has all been dismissed/errored).
	const isCurrent = result !== null && result.chart === chart;
	const isLoading = !isCurrent && !failed;

	if (failed) {
		return (
			<div className={cn("my-4 rounded-lg border border-dashed border-destructive/40 px-4 py-4 text-sm text-muted-foreground", className)}>
				Failed to render diagram — the mermaid source may be invalid.
			</div>
		);
	}

	if (isLoading || result === null) {
		return <div className={cn("my-4 h-24 animate-pulse rounded-lg border border-border bg-muted/40", className)} aria-label="Loading diagram" />;
	}

	return (
		<div
			className={cn("my-4 flex justify-center overflow-x-auto rounded-lg border border-border bg-background p-4", className)}
			dangerouslySetInnerHTML={{ __html: result.svg }}
		/>
	);
}
