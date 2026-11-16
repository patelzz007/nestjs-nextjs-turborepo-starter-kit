// A muted tray that holds one or more card-like panels, with an optional
// title bar and footer (the web kit's `Frame`, ported from ReUI): the same
// parts — Frame, FramePanel, FrameHeader, FrameTitle, FrameDescription,
// FrameFooter — and props.
//
// - `variant`: `default` (a bordered tray), `inverse` (a page-coloured tray
//   with faint panels) or `ghost` (no border: only the fill marks its edge).
// - `spacing`: the panels' padding and the bars' height, `xs`–`lg`.
// - `stacked`: the panels join into one column with shared borders.
// - `dense`: no inset — the panels sit flush with the tray's edge.
// - `radius`: the tray's corner; each panel nests one step inside it, so the
//   two arcs stay parallel (flush panels share the tray's corner).
//
// The web reads these through CSS variables and sibling selectors; here the
// frame hands them to its parts through context, and tells each panel where
// it sits in a stacked column. Presentational; refs reach each root view.

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { Text, type TextInstance, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";

export const frameVariants = cva("gap-0.75 bg-muted/50", {
	variants: {
		variant: { default: "border border-border", inverse: "border border-border bg-background", ghost: "" },
		radius: { sm: "rounded-sm", md: "rounded-md", lg: "rounded-lg", xl: "rounded-xl", "2xl": "rounded-2xl" },
		dense: { true: "gap-0 p-0", false: "p-0.75" },
	},
	defaultVariants: { variant: "default", radius: "xl", dense: false },
});

/** Where a panel sits in a stacked column: its corners and top border follow. */
type PanelPosition = "only" | "first" | "middle" | "last";

export const framePanelVariants = cva("overflow-hidden border border-border shadow-xs", {
	variants: {
		variant: { default: "bg-card", inverse: "bg-muted/40", ghost: "bg-card" },
		spacing: { xs: "p-2", sm: "px-3 py-3.5", md: "p-4", lg: "p-5" },
		/** One radius step inside the tray's corner. */
		radius: { sm: "rounded-xs", md: "rounded-sm", lg: "rounded-md", xl: "rounded-lg", "2xl": "rounded-xl" },
		position: { only: "", first: "rounded-b-none", middle: "rounded-none border-t-0", last: "rounded-t-none border-t-0" },
		dense: { true: "-mx-px", false: "" },
		fit: { true: "", false: "grow" },
		/** Apart from the panel above it (not stacked), by the spacing's gap. */
		spaced: { true: "", false: "" },
	},
	compoundVariants: [
		{ dense: true, radius: "sm", className: "rounded-sm" },
		{ dense: true, radius: "md", className: "rounded-md" },
		{ dense: true, radius: "lg", className: "rounded-lg" },
		{ dense: true, radius: "xl", className: "rounded-xl" },
		{ dense: true, radius: "2xl", className: "rounded-2xl" },
		{ spaced: true, spacing: "sm", className: "mt-0.5" },
		{ spaced: true, spacing: "md", className: "mt-1" },
		{ spaced: true, spacing: "lg", className: "mt-2" },
	],
	defaultVariants: { variant: "default", spacing: "md", radius: "xl", position: "only", dense: false, fit: false, spaced: false },
});

/** The title bar and the footer: level with the panels' sides, about half their height. */
export const frameBarVariants = cva("", {
	variants: { spacing: { xs: "px-2 py-0.5", sm: "px-3 py-1.5", md: "px-4 py-2", lg: "px-5 py-2.5" }, part: { header: "", footer: "gap-1" } },
	defaultVariants: { spacing: "md", part: "header" },
});

export const frameTitleVariants = cva("text-label font-sans-semibold text-foreground");
export const frameDescriptionVariants = cva("text-label font-sans text-muted-foreground");

type FrameVariantProps = VariantProps<typeof frameVariants>;
export type FrameVariant = NonNullable<FrameVariantProps["variant"]>;
export type FrameRadius = NonNullable<FrameVariantProps["radius"]>;
export type FrameSpacing = NonNullable<VariantProps<typeof framePanelVariants>["spacing"]>;

interface FrameLook {
	readonly variant: FrameVariant;
	readonly spacing: FrameSpacing;
	readonly radius: FrameRadius;
	readonly dense: boolean;
}

const FrameContext = React.createContext<FrameLook>({ variant: "default", spacing: "md", radius: "xl", dense: false });

interface PanelPlacement {
	readonly position: PanelPosition;
	/** Apart from the panel just above it. */
	readonly spaced: boolean;
}

const PanelPlacementContext = React.createContext<PanelPlacement>({ position: "only", spaced: false });

interface FramePartProps {
	readonly children?: React.ReactNode;
	/** Extra classes, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

export interface FrameProps extends FramePartProps {
	readonly variant?: FrameVariant | undefined;
	readonly spacing?: FrameSpacing | undefined;
	readonly radius?: FrameRadius | undefined;
	/** The panels join into one column with shared borders. */
	readonly stacked?: boolean | undefined;
	/** The panels sit flush with the tray's edge. */
	readonly dense?: boolean | undefined;
}

/** Where each child that is a panel (`isPanel`) sits: runs of adjacent panels join when stacked, else each panel after another is spaced. */
export function framePanelPlacements(isPanel: readonly boolean[], stacked: boolean): readonly (PanelPlacement | null)[] {
	return isPanel.map((panel: boolean, index: number): PanelPlacement | null => {
		if (!panel) {
			return null;
		}
		const before = isPanel.at(index - 1) === true && index > 0;
		const after = isPanel.at(index + 1) === true;
		if (!stacked) {
			return { position: "only", spaced: before };
		}
		const position: PanelPosition = before ? (after ? "middle" : "last") : after ? "first" : "only";
		return { position, spaced: false };
	});
}

export const Frame = React.memo(
	React.forwardRef<ViewInstance, FrameProps>(function Frame(
		{ children, variant = "default", spacing = "md", radius = "xl", stacked = false, dense = false, className, testID },
		ref,
	): React.JSX.Element {
		const look = React.useMemo((): FrameLook => ({ variant, spacing, radius, dense }), [dense, radius, spacing, variant]);
		const parts = React.Children.toArray(children);
		const placements = framePanelPlacements(
			parts.map((part: React.ReactNode): boolean => React.isValidElement(part) && part.type === FramePanel),
			stacked,
		);
		return (
			<FrameContext.Provider value={look}>
				<View ref={ref} testID={testID} className={cn(frameVariants({ variant, radius, dense }), stacked ? "gap-0" : undefined, className)}>
					{parts.map((part: React.ReactNode, index: number): React.ReactNode => {
						const placement = placements.at(index);
						// Children.toArray keys every element: a panel's provider takes its key.
						return placement === undefined || placement === null || !React.isValidElement(part) ? (
							part
						) : (
							<PanelPlacementContext.Provider key={part.key} value={placement}>
								{part}
							</PanelPlacementContext.Provider>
						);
					})}
				</View>
			</FrameContext.Provider>
		);
	}),
);

export interface FramePanelProps extends FramePartProps {
	/** Size the panel to its content; otherwise it grows into the frame's spare height. */
	readonly fit?: boolean | undefined;
}

/** One bordered panel inside the frame. */
export const FramePanel = React.memo(
	React.forwardRef<ViewInstance, FramePanelProps>(function FramePanel({ children, fit = false, className, testID }, ref): React.JSX.Element {
		const { variant, spacing, radius, dense } = React.use(FrameContext);
		const { position, spaced } = React.use(PanelPlacementContext);
		return (
			<View ref={ref} testID={testID} className={cn(framePanelVariants({ variant, spacing, radius, position, dense, fit, spaced }), className)}>
				{children}
			</View>
		);
	}),
);

/** The frame's title bar. */
export const FrameHeader = React.memo(
	React.forwardRef<ViewInstance, FramePartProps>(function FrameHeader({ children, className, testID }, ref): React.JSX.Element {
		const { spacing } = React.use(FrameContext);
		return (
			<View ref={ref} testID={testID} className={cn(frameBarVariants({ spacing, part: "header" }), className)}>
				{children}
			</View>
		);
	}),
);

/** The frame's title. */
export const FrameTitle = React.memo(
	React.forwardRef<TextInstance, FramePartProps>(function FrameTitle({ children, className, testID }, ref): React.JSX.Element {
		return (
			<Text ref={ref} accessibilityRole="header" testID={testID} className={cn(frameTitleVariants(), className)}>
				{children}
			</Text>
		);
	}),
);

/** A line under the frame's title. */
export const FrameDescription = React.memo(
	React.forwardRef<TextInstance, FramePartProps>(function FrameDescription({ children, className, testID }, ref): React.JSX.Element {
		return (
			<Text ref={ref} testID={testID} className={cn(frameDescriptionVariants(), className)}>
				{children}
			</Text>
		);
	}),
);

/** A line under the panels. */
export const FrameFooter = React.memo(
	React.forwardRef<ViewInstance, FramePartProps>(function FrameFooter({ children, className, testID }, ref): React.JSX.Element {
		const { spacing } = React.use(FrameContext);
		return (
			<View ref={ref} testID={testID} className={cn(frameBarVariants({ spacing, part: "footer" }), className)}>
				{children}
			</View>
		);
	}),
);
