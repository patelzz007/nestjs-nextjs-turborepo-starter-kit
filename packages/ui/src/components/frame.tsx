// Ported from ReUI (https://reui.io/r/base-vega/frame.json): a muted tray that
// holds one or more card-like panels, with optional header / footer bars.
// Part names, props (`variant`, `spacing`, `stacked`, `dense`, `fit`) and
// `data-slot` attributes match ReUI, so its examples apply, with these
// deliberate deviations:
// - Every part forwards its ref.
// - The panel edge highlight reads `--foreground` instead of raw black /
//   white, so it follows the theme without a `dark:` override.
//
// Frame sets --frame-panel-bg and --frame-panel-border-color; FramePanel reads
// them back as bg-(--frame-panel-bg) and border-(--frame-panel-border-color).
// So variant="inverse" re-points every panel from one place, and a consumer's
// own bg-* on a panel still wins on source order.
import { cn } from "@workspace/ui/lib/core/utils";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

const frameVariants = cva(
	[
		"relative flex flex-col gap-(--frame-gap) rounded-(--frame-radius) bg-muted/50 px-(--frame-px) py-(--frame-py)",
		"[--frame-radius:var(--radius-xl)]",
		"[--frame-gap:--spacing(0.75)] [--frame-panel-footer-gap:--spacing(1)] [--frame-panel-header-gap:0rem] [--frame-px:--spacing(0.75)] [--frame-py:--spacing(0.75)]",
		"[--frame-panel-footer-px-adjust:0px] [--frame-panel-footer-py-adjust:0px] [--frame-panel-header-px-adjust:0px] [--frame-panel-header-py-adjust:0px] [--frame-panel-px-adjust:0px] [--frame-panel-py-adjust:0px]",
		"[--frame-panel-footer-px:calc(var(--frame-panel-footer-px-base)+var(--frame-panel-footer-px-adjust))] [--frame-panel-footer-py:calc(var(--frame-panel-footer-py-base)+var(--frame-panel-footer-py-adjust))] [--frame-panel-header-px:calc(var(--frame-panel-header-px-base)+var(--frame-panel-header-px-adjust))] [--frame-panel-header-py:calc(var(--frame-panel-header-py-base)+var(--frame-panel-header-py-adjust))] [--frame-panel-px:calc(var(--frame-panel-px-base)+var(--frame-panel-px-adjust))] [--frame-panel-py:calc(var(--frame-panel-py-base)+var(--frame-panel-py-adjust))]",
		"[--frame-border-color:var(--color-border)] [--frame-panel-bg:var(--color-card)] [--frame-panel-border-color:var(--color-border)]",
		// Concentric: the panel nests inside the frame's corner rather than copying
		// it. It is inset by the 1px border plus --frame-px, so subtracting exactly
		// that keeps the two arcs parallel. `ghost` drops the border term (no
		// border), `dense` pins it to the frame radius (panels sit flush).
		"[--frame-panel-radius:calc(var(--frame-radius)-var(--frame-px)-1px)]",
	],
	{
		variants: {
			variant: {
				default: "border border-(--frame-border-color) bg-clip-padding",
				inverse: "border border-(--frame-border-color) bg-background bg-clip-padding [--frame-panel-bg:color-mix(in_oklch,var(--color-muted)_40%,transparent)]",
				ghost: "[--frame-panel-radius:calc(var(--frame-radius)-var(--frame-px))]",
			},
			// Bars read as chrome, not a second content block: their py is about half
			// the body's, while px stays level with the body so header, content and
			// footer left-align.
			spacing: {
				xs: "[--frame-panel-footer-px-base:--spacing(2)] [--frame-panel-footer-py-base:--spacing(0.5)] [--frame-panel-header-px-base:--spacing(2)] [--frame-panel-header-py-base:--spacing(0.5)] [--frame-panel-px-base:--spacing(2)] [--frame-panel-py-base:--spacing(2)]",
				sm: "[--frame-panel-footer-px-base:--spacing(3)] [--frame-panel-footer-py-base:--spacing(1.5)] [--frame-panel-header-px-base:--spacing(3)] [--frame-panel-header-py-base:--spacing(1.5)] [--frame-panel-px-base:--spacing(3)] [--frame-panel-py-base:--spacing(3.5)]",
				default:
					"[--frame-panel-footer-px-base:--spacing(4)] [--frame-panel-footer-py-base:--spacing(2)] [--frame-panel-header-px-base:--spacing(4)] [--frame-panel-header-py-base:--spacing(2)] [--frame-panel-px-base:--spacing(4)] [--frame-panel-py-base:--spacing(4)]",
				lg: "[--frame-panel-footer-px-base:--spacing(5)] [--frame-panel-footer-py-base:--spacing(2.5)] [--frame-panel-header-px-base:--spacing(5)] [--frame-panel-header-py-base:--spacing(2.5)] [--frame-panel-px-base:--spacing(5)] [--frame-panel-py-base:--spacing(5)]",
			},
			stacked: {
				true: [
					"gap-0 *:has-[+[data-slot=frame-panel]]:rounded-b-none",
					"*:has-[+[data-slot=frame-panel]]:before:hidden",
					"*:[[data-slot=frame-panel]+[data-slot=frame-panel]]:rounded-t-none",
					"*:[[data-slot=frame-panel]+[data-slot=frame-panel]]:border-t-0",
				],
				false: [
					"data-[spacing=sm]:*:[[data-slot=frame-panel]+[data-slot=frame-panel]]:mt-0.5",
					"data-[spacing=default]:*:[[data-slot=frame-panel]+[data-slot=frame-panel]]:mt-1",
					"data-[spacing=lg]:*:[[data-slot=frame-panel]+[data-slot=frame-panel]]:mt-2",
				],
			},
			dense: {
				// Parent selectors, not CSS vars: these are positional. Panels are
				// pulled flush (-mx-px), so corners align with the frame's own radius.
				true: "gap-0 border-(--frame-border-color) p-0 [--frame-panel-radius:var(--frame-radius)] [&_[data-slot=frame-panel]]:-mx-px [&_[data-slot=frame-panel]]:before:hidden [&_[data-slot=frame-panel]:last-child]:-mb-px [&:not(:has([data-slot=frame-panel-header]))_[data-slot=frame-panel]:is(:first-child)]:-mt-px",
				false: "",
			},
		},
		defaultVariants: {
			variant: "default",
			spacing: "default",
			stacked: false,
			dense: false,
		},
	},
);

type FrameProps = React.ComponentProps<"div"> & VariantProps<typeof frameVariants>;

const Frame = React.forwardRef<HTMLDivElement, FrameProps>(function Frame({ className, variant, spacing, stacked, dense, ...props }, ref): React.JSX.Element {
	return <div ref={ref} className={cn(frameVariants({ variant, spacing, stacked, dense }), className)} data-slot="frame" data-spacing={spacing ?? undefined} {...props} />;
});

interface FramePanelProps extends React.ComponentProps<"div"> {
	/** Size the panel to its content; otherwise it grows to fill the frame. */
	readonly fit?: boolean | undefined;
}

const FramePanel = React.forwardRef<HTMLDivElement, FramePanelProps>(function FramePanel({ className, fit = false, ...props }, ref): React.JSX.Element {
	return (
		<div
			ref={ref}
			className={cn(
				"relative overflow-hidden rounded-(--frame-panel-radius) border border-(--frame-panel-border-color) bg-(--frame-panel-bg) bg-clip-padding shadow-xs",
				!fit && "grow",
				"before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--frame-panel-radius)-1px)] before:shadow-foreground/5",
				"dark:bg-clip-border",
				"px-(--frame-panel-px) py-(--frame-panel-py)",
				className,
			)}
			data-slot="frame-panel"
			{...props}
		/>
	);
});

const FrameHeader = React.forwardRef<HTMLElement, React.ComponentProps<"header">>(function FrameHeader({ className, ...props }, ref): React.JSX.Element {
	return (
		<header
			ref={ref}
			className={cn("flex flex-col gap-(--frame-panel-header-gap) px-(--frame-panel-header-px) py-(--frame-panel-header-py)", className)}
			data-slot="frame-panel-header"
			{...props}
		/>
	);
});

const FrameTitle = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(function FrameTitle({ className, ...props }, ref): React.JSX.Element {
	return <div ref={ref} className={cn("text-sm font-semibold", className)} data-slot="frame-panel-title" {...props} />;
});

const FrameDescription = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(function FrameDescription({ className, ...props }, ref): React.JSX.Element {
	return <div ref={ref} className={cn("text-sm text-muted-foreground", className)} data-slot="frame-panel-description" {...props} />;
});

const FrameFooter = React.forwardRef<HTMLElement, React.ComponentProps<"footer">>(function FrameFooter({ className, ...props }, ref): React.JSX.Element {
	return (
		<footer
			ref={ref}
			className={cn("flex flex-col gap-(--frame-panel-footer-gap) px-(--frame-panel-footer-px) py-(--frame-panel-footer-py)", className)}
			data-slot="frame-panel-footer"
			{...props}
		/>
	);
});

export { Frame, FrameDescription, FrameFooter, FrameHeader, FramePanel, FrameTitle, frameVariants };
export type { FramePanelProps, FrameProps };
