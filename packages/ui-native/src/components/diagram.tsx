// The web kit's `Diagram` for a phone: Mermaid-syntax text drawn by Pele (https://pele.run) as SVG, themed from the
// design tokens (the same `--pele-*` → token map the web uses) and drawn by react-native-svg. Every Mermaid type Pele
// draws works; the layout fits the width it is given (a wide flowchart turns vertical on a phone), and a diagram
// still wider than the screen scrolls sideways. `accTitle:` names it for a screen reader and `accDescr:` summarises
// it. A source Pele cannot read shows its reason in place of the diagram.

import { cva } from "class-variance-authority";
import { render } from "pele";
import * as React from "react";
import { ScrollView, Text, View, type LayoutChangeEvent, type ViewInstance } from "react-native";
import { SvgXml } from "react-native-svg";
import { useCSSVariable } from "uniwind";

import { cn } from "../lib/cn";
import { DEFAULT_DIAGRAM_LABELS, DIAGRAM_RADIUS, DIAGRAM_THEME_VARIABLES, diagramSummary, resolveDiagramSvg, type DiagramLabels } from "../lib/diagram";
import { Skeleton } from "./skeleton";

export const diagramVariants = cva("gap-3");

export const diagramCardVariants = cva("rounded-xl border border-border bg-card p-4");

const BUSY = { busy: true };

export interface DiagramProps {
	/** The diagram in Mermaid syntax. Name it with `accTitle:` and summarise it with `accDescr:`. Pass trusted sources. */
	readonly source: string;
	/** A caption under the diagram. */
	readonly caption?: string | undefined;
	readonly labels?: Partial<DiagramLabels> | undefined;
	/** Extra classes for the figure, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

const CSS_VARIABLES: string[] = DIAGRAM_THEME_VARIABLES.map(([, cssVariable]): string => cssVariable);

/** The card's padding on each side, in points (`p-4`): the diagram is fitted to the width inside it. */
const CARD_PADDING = 16;

type Drawn = { readonly kind: "drawn"; readonly svg: string; readonly width: number; readonly height: number } | { readonly kind: "error"; readonly reason: string };

/** The theme's literal colour for every Pele variable, or `null` until the stylesheet has them all. */
function useDiagramTheme(): Readonly<Record<string, string>> | null {
	const values = useCSSVariable(CSS_VARIABLES);
	return React.useMemo((): Readonly<Record<string, string>> | null => {
		const entries = DIAGRAM_THEME_VARIABLES.map(([variable], index: number): readonly [string, string] | null => {
			const value = values.at(index);
			return value === undefined ? null : [variable, String(value)];
		});
		return entries.every((entry): entry is readonly [string, string] => entry !== null) ? { ...Object.fromEntries(entries), "--pele-radius": DIAGRAM_RADIUS } : null;
	}, [values]);
}

export const Diagram = React.memo(
	React.forwardRef<ViewInstance, DiagramProps>(function Diagram({ source, caption, labels: overrides, className, testID }, ref): React.JSX.Element {
		const labels: DiagramLabels = { ...DEFAULT_DIAGRAM_LABELS, ...overrides };
		const theme = useDiagramTheme();
		const [width, setWidth] = React.useState(0);
		const idPrefix = `diagram-${React.useId().replace(/[^\w-]/gu, "")}`;
		const measure = React.useCallback((event: LayoutChangeEvent): void => {
			setWidth(Math.max(0, event.nativeEvent.layout.width - CARD_PADDING * 2));
		}, []);
		const drawn = React.useMemo((): Drawn | null => {
			if (theme === null || width === 0) {
				return null;
			}
			try {
				const result = render(source, { idPrefix, maxWidth: width, responsive: false });
				return { kind: "drawn", svg: resolveDiagramSvg(result.svg, theme), width: result.width, height: result.height };
			} catch (error) {
				return { kind: "error", reason: error instanceof Error ? error.message : "" };
			}
		}, [idPrefix, source, theme, width]);
		const summary = drawn?.kind === "drawn" ? diagramSummary(drawn.svg) : null;
		const accessibilityLabel = summary === null ? undefined : [summary.title, summary.description].filter((part: string): boolean => part !== "").join(". ") || caption;
		return (
			<View ref={ref} className={cn(diagramVariants(), className)} testID={testID}>
				<View onLayout={measure} className={diagramCardVariants()} testID={testID === undefined ? undefined : `${testID}-card`}>
					{drawn === null ? (
						<View accessible accessibilityLabel={labels.loading} accessibilityState={BUSY}>
							<Skeleton className="h-48 w-full rounded-lg" />
						</View>
					) : drawn.kind === "error" ? (
						<View accessible accessibilityRole="alert" className="gap-1">
							<Text className="text-label font-sans-medium text-destructive">{labels.error}</Text>
							{drawn.reason === "" ? null : <Text className="text-caption font-mono text-muted-foreground">{drawn.reason}</Text>}
						</View>
					) : (
						<ScrollView horizontal showsHorizontalScrollIndicator={drawn.width > width} scrollEnabled={drawn.width > width} contentContainerClassName="grow justify-center">
							<View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
								<SvgXml xml={drawn.svg} width={drawn.width} height={drawn.height} />
							</View>
						</ScrollView>
					)}
				</View>
				{caption === undefined ? null : <Text className="text-caption text-center font-sans text-muted-foreground">{caption}</Text>}
			</View>
		);
	}),
);
