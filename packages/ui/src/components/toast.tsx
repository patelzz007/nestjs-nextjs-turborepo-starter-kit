"use client";

import { Toast as ToastPrimitive, type ToastObject } from "@base-ui/react/toast";
import { Button } from "@workspace/ui/components/button";
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import { cn } from "@workspace/ui/lib/core/utils";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import { CircleCheckIcon, InfoIcon, Loader2Icon, OctagonXIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import * as React from "react";
import { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { z } from "zod";

// ════════════════════════════════════════════════════════════════════════════
// Toast — base-ui toast manager wrapper.
//
// Satisfies the ui-components audit (20 improvements + 20 features):
//   - zod schemas + inferred types (`toastTypeSchema`, `toastPositionSchema`,
//     `toastDataSchema`) — rule 13, no inline unions
//   - module-scoped type→icon lookup map (improvement 2)
//   - every part that renders DOM forwards its ref (ToastProvider/Toaster
//     render none of their own and stay plain functions)
//   - all copy comes from the `toast` family of `UiKitLabelsProvider`,
//     overridable per Toaster (`labels`) — per-part `closeLabel`/`viewportLabel`
//     still win
//   - six-position placement (bottom/top × left/center/right) via a viewport
//     context (improvement 5 + feature 11) — the card anchors to the edge and
//     slides in from the correct side
//   - typed `data` slot (progress bar, custom icon)
//   - imperative manager (`toast.add/close/update/promise`), multi-manager
//     isolation via `createToastManager` + `toastMessage` typed helpers
//   - swipe-to-dismiss + auto-dismiss timeout (base-ui native)
//   - per-type opaque tone-soft surfaces + icon + countdown tint
//   - auto-dismiss countdown bar draining over the remaining time (default 5s),
//     with a ticking "Dismisses in Xs" label that freezes on hover/focus ANYWHERE
//     in the stack + window blur — mirroring base-ui's viewport-wide timer pause
//     (feature 19 — the smart component owns the copy via `countdownLabel`)
//   - position-aware swipe directions (top stacks dismiss up, bottom dismiss down)
//   - priority → aria-live mapping via `toastA11yProps` (improvement 10)
//
// Data lives in the smart component — this file renders what it is given.
// ════════════════════════════════════════════════════════════════════════════

// ── Zod schemas (rule 13) ───────────────────────────────────────────────────

/** The five toast types, mirrored by the icon map below. */
const toastTypeSchema = z.enum(["success", "info", "warning", "error", "loading"]);

/** Where the toast stack sits on screen — six placements (improvement 5 + feature 11). */
const toastPositionSchema = z.enum(["bottom-right", "bottom-left", "bottom-center", "top-right", "top-left", "top-center"]);

/** Typed custom payload attached to a toast (features: progress bar, icon). */
const toastDataSchema = z.object({
	/** 0–100 progress rendered as a thin bar at the toast's bottom edge (feature 12). */
	progress: z.number().min(0).max(100).optional(),
	/** Overrides the per-type default icon (feature 13) — a rendered element, e.g. `<Gift />`; checked, not cast. */
	icon: z.custom<React.ReactElement>((value): boolean => React.isValidElement(value)).optional(),
});

type ToastType = z.infer<typeof toastTypeSchema>;
type ToastPosition = z.infer<typeof toastPositionSchema>;
type ToastData = z.infer<typeof toastDataSchema>;

// ── Named constants (no magic numbers) ──────────────────────────────────────

/** Default auto-dismiss duration (ms) when neither the provider nor the toast sets one. */
const DEFAULT_TOAST_TIMEOUT_MS = 5000;
/** Default number of visible toasts before the oldest are limited. */
const DEFAULT_TOAST_LIMIT = 3;
/** Countdown-label tick interval (ms) — fine enough that the whole-second label never lags visibly. */
const COUNTDOWN_TICK_MS = 100;
/** Milliseconds per second — converts the remaining time into the label's whole seconds. */
const MS_PER_SECOND = 1000;
/** Bounds of the `data.progress` percentage. */
const PROGRESS_MIN = 0;
const PROGRESS_MAX = 100;

// ── Copy (rule 7: no hardcoded user-facing strings inside the parts) ────────

/** Every user-visible string the toast parts render — the `toast` family of `UiKitLabels`. */
export interface ToastLabels {
	/** Accessible name of the live-region viewport. */
	readonly viewport: string;
	/** Accessible name of each toast's close button. */
	readonly close: string;
	/** Renders the ticking auto-dismiss readout for a whole number of seconds. */
	readonly countdown: (seconds: number) => ReactNode;
	/** Accessible label `toastA11yProps` returns for high-priority (error) toasts. */
	readonly errorAnnouncement: string;
	/** Accessible label `toastA11yProps` returns for every other toast. */
	readonly notificationAnnouncement: string;
}

/** Icon component map — module-scoped (improvement 2: no if-chain, no `let`). */
const TOAST_TYPE_ICONS: Readonly<Record<ToastType, React.ComponentType<{ readonly className?: string }>>> = {
	success: CircleCheckIcon,
	info: InfoIcon,
	warning: TriangleAlertIcon,
	error: OctagonXIcon,
	loading: Loader2Icon,
};

interface ToastTypeStyles {
	/** Glyph tint — tone palette (AA on the matching soft fill). */
	readonly icon: string;
	/** Opaque soft fill + full border — categorical tones, neutral body copy. */
	readonly card: string;
	/** Countdown-bar fill (drains over the auto-dismiss timeout). */
	readonly countdown: string;
}

/** Opaque tone-soft cards (not alpha washes, not neon `text-success` on `*-soft`). */
const TOAST_TYPE_STYLES: Readonly<Record<ToastType, ToastTypeStyles>> = {
	success: {
		icon: "text-tone-green",
		card: "border-tone-green/30 bg-tone-green-soft text-foreground shadow-lg dark:border-tone-green/40",
		countdown: "bg-tone-green/55",
	},
	warning: {
		icon: "text-tone-yellow",
		card: "border-tone-yellow/30 bg-tone-yellow-soft text-foreground shadow-lg dark:border-tone-yellow/40",
		countdown: "bg-tone-yellow/55",
	},
	error: {
		icon: "text-tone-red",
		card: "border-tone-red/30 bg-tone-red-soft text-foreground shadow-lg dark:border-tone-red/40",
		countdown: "bg-tone-red/55",
	},
	info: {
		icon: "text-tone-blue",
		card: "border-tone-blue/30 bg-tone-blue-soft text-foreground shadow-lg dark:border-tone-blue/40",
		countdown: "bg-tone-blue/55",
	},
	loading: {
		icon: "text-muted-foreground",
		card: "border-border bg-muted text-foreground shadow-lg",
		countdown: "bg-foreground/25",
	},
};

/** aria-live priority per type (improvement 10: errors interrupt, notices don't). */
const TOAST_TYPE_PRIORITY: Readonly<Record<ToastType, "low" | "high">> = {
	success: "low",
	info: "low",
	warning: "low",
	error: "high",
	loading: "low",
};

/** Viewport anchor classes per position — mobile is near-full-width; sm+ hugs the corner/edge. */
const TOAST_POSITION_CLASSES: Readonly<Record<ToastPosition, string>> = {
	"bottom-right": "bottom-4 sm:start-auto sm:end-4 sm:mx-0 sm:w-full",
	"bottom-left": "bottom-4 sm:start-4 sm:end-auto sm:mx-0 sm:w-full",
	"bottom-center": "bottom-4 sm:inset-x-0 sm:mx-auto sm:w-full",
	"top-right": "top-4 sm:start-auto sm:end-4 sm:mx-0 sm:w-full",
	"top-left": "top-4 sm:start-4 sm:end-auto sm:mx-0 sm:w-full",
	"top-center": "top-4 sm:inset-x-0 sm:mx-auto sm:w-full",
};

type ToastEdge = "top" | "bottom";

/** Which vertical edge a position hugs — drives the card anchor, origin and slide direction. */
function toastPositionEdge(position: ToastPosition): ToastEdge {
	return position.startsWith("top") ? "top" : "bottom";
}

/** Swipe direction(s) that dismiss a toast — toward its edge. Module-scoped so each edge keeps one array identity. */
const TOAST_EDGE_SWIPE: Readonly<Record<ToastEdge, ("up" | "down")[]>> = {
	top: ["up"],
	bottom: ["down"],
};

// ── Viewport position context (improvement 5) ───────────────────────────────
// The viewport declares where the stack lives; the card reads it back so the
// entrance/exit transforms slide from the correct edge.

const ToastViewportPositionContext = createContext<ToastPosition>("bottom-right");

function useToastPosition(): ToastPosition {
	return useContext(ToastViewportPositionContext);
}

/** Provider-level auto-dismiss duration — lets the card render the countdown accurately. */
const ToastTimeoutContext = createContext<number>(DEFAULT_TOAST_TIMEOUT_MS);

function useToastTimeout(): number {
	return useContext(ToastTimeoutContext);
}

/** The provider's resolved copy (`toast` family + its per-Toaster overrides) for every part below it. */
const ToastLabelsContext = createContext<ToastLabels | null>(null);

/**
 * The nearest `ToastProvider`'s resolved copy, or the `toast` family from
 * `UiKitLabelsProvider` for parts rendered outside a toast provider.
 */
function useToastLabels(): ToastLabels {
	const familyLabels = useUiKitLabels("toast");
	return useContext(ToastLabelsContext) ?? familyLabels;
}

/**
 * Shared pause state mirroring base-ui's dismiss-timer pause conditions.
 *
 * base-ui pauses EVERY toast's timer when ANY toast is hovered or focused
 * (store selector `expanded = hovering || focused`, wired viewport-wide) and
 * while the window is blurred (`expandedOrOutOfFocus`). The countdown label
 * must freeze under the exact same conditions — otherwise hovering one card
 * keeps the OTHER card's label ticking while its real timer is frozen, and the
 * "Dismisses in Xs" text drifts from the actual dismissal.
 */
interface ToastInteractionContextValue {
	readonly paused: boolean;
	readonly setHovered: (hovered: boolean) => void;
	readonly setFocused: (focused: boolean) => void;
}

const ToastInteractionContext = createContext<ToastInteractionContextValue | null>(null);

function useToastInteraction(): ToastInteractionContextValue {
	const value = useContext(ToastInteractionContext);
	if (value === null) {
		throw new Error("useToastInteraction must be used within a ToastProvider");
	}
	return value;
}

/** Single window focus/blur listener — lives in the provider so rows don't each add one.
 *  Initialises `true`; if the window is already blurred at mount the label ticks once
 *  until the next focus/blur event lands (a sub-100ms edge we accept to stay clear of
 *  the `set-state-in-effect` rule). */
function useWindowFocused(): boolean {
	const [focused, setFocused] = useState<boolean>(true);
	useEffect(() => {
		const handleFocus = (): void => {
			setFocused(true);
		};
		const handleBlur = (): void => {
			setFocused(false);
		};
		window.addEventListener("focus", handleFocus);
		window.addEventListener("blur", handleBlur);
		return (): void => {
			window.removeEventListener("focus", handleFocus);
			window.removeEventListener("blur", handleBlur);
		};
	}, []);
	return focused;
}

// ── Manager ─────────────────────────────────────────────────────────────────

const toast = ToastPrimitive.createToastManager<ToastData>();

// ── Primitive wrappers (improvement 3: refs forwarded) ──────────────────────

// `ToastProvider` is a plain `React.FC` in base-ui (no ref) — plain function.
// It also exposes the provider `timeout` via context so cards can render an
// accurate auto-dismiss countdown even when the toast didn't set one explicitly.
export interface ToastProviderProps extends ToastPrimitive.Provider.Props {
	/** Per-usage overrides of the `toast` copy from `UiKitLabelsProvider`. */
	readonly labels?: UiKitLabelsOverride<"toast"> | undefined;
	/** Countdown-label renderer — shorthand that overrides `labels.countdown`. */
	readonly countdownLabel?: ((seconds: number) => ReactNode) | undefined;
}

function ToastProvider({ timeout = DEFAULT_TOAST_TIMEOUT_MS, labels, countdownLabel, ...props }: ToastProviderProps): React.JSX.Element {
	const familyLabels = useUiKitLabels("toast", labels);
	const windowFocused = useWindowFocused();
	const resolvedLabels = useMemo<ToastLabels>(
		() => (countdownLabel === undefined ? familyLabels : { ...familyLabels, countdown: countdownLabel }),
		[familyLabels, countdownLabel],
	);
	// Ref-counted hover/focus: cards increment/decrement as the pointer or focus
	// moves between them, so the shared pause never drops while still engaged
	// (e.g. mouse leaving one card directly onto another).
	const hoverCountRef = useRef<number>(0);
	const focusCountRef = useRef<number>(0);
	const [interactionPaused, setInteractionPaused] = useState<boolean>(false);

	const setHovered = useCallback((hovered: boolean): void => {
		hoverCountRef.current = Math.max(0, hoverCountRef.current + (hovered ? 1 : -1));
		setInteractionPaused(hoverCountRef.current > 0 || focusCountRef.current > 0);
	}, []);

	const setFocused = useCallback((focused: boolean): void => {
		focusCountRef.current = Math.max(0, focusCountRef.current + (focused ? 1 : -1));
		setInteractionPaused(hoverCountRef.current > 0 || focusCountRef.current > 0);
	}, []);

	// Touch taps outside the stack clear any lingering pause — mirrors base-ui's
	// touch-only `handleDocumentPointerDown` in the store.
	useEffect(() => {
		const handlePointerDown = (event: PointerEvent): void => {
			if (event.pointerType !== "touch") {
				return;
			}
			hoverCountRef.current = 0;
			focusCountRef.current = 0;
			setInteractionPaused(false);
		};
		document.addEventListener("pointerdown", handlePointerDown);
		return (): void => {
			document.removeEventListener("pointerdown", handlePointerDown);
		};
	}, []);

	const interactionValue = useMemo<ToastInteractionContextValue>(
		() => ({ paused: interactionPaused || !windowFocused, setHovered, setFocused }),
		[interactionPaused, windowFocused, setHovered, setFocused],
	);

	return (
		<ToastTimeoutContext.Provider value={timeout}>
			<ToastLabelsContext.Provider value={resolvedLabels}>
				<ToastInteractionContext.Provider value={interactionValue}>
					<ToastPrimitive.Provider timeout={timeout} {...props} />
				</ToastInteractionContext.Provider>
			</ToastLabelsContext.Provider>
		</ToastTimeoutContext.Provider>
	);
}

const ToastPortal = React.forwardRef<HTMLDivElement, ToastPrimitive.Portal.Props>(function ToastPortal({ ...props }, ref): React.JSX.Element {
	return <ToastPrimitive.Portal ref={ref} data-slot="toast-portal" {...props} />;
});

export interface ToastViewportProps extends ToastPrimitive.Viewport.Props {
	/** Where the stack sits (improvement 5 + feature 11). @default "bottom-right" */
	readonly position?: ToastPosition;
	/** Accessible label for the live region (feature 16). @default labels.viewport */
	readonly viewportLabel?: string;
}

const ToastViewport = React.forwardRef<HTMLDivElement, ToastViewportProps>(function ToastViewport(
	{ className, position = "bottom-right", viewportLabel, ...props },
	ref,
): React.JSX.Element {
	const labels = useToastLabels();
	return (
		<ToastViewportPositionContext.Provider value={position}>
			<ToastPrimitive.Viewport
				ref={ref}
				data-slot="toast-viewport"
				aria-label={viewportLabel ?? labels.viewport}
				className={cn("pointer-events-none fixed inset-x-4 z-toast mx-auto w-auto max-w-sm outline-none", TOAST_POSITION_CLASSES[position], className)}
				{...props}
			/>
		</ToastViewportPositionContext.Provider>
	);
});

const Toast = React.forwardRef<HTMLDivElement, ToastPrimitive.Root.Props>(function Toast({ className, ...props }, ref): React.JSX.Element {
	const position = useToastPosition();
	const edge = toastPositionEdge(position);
	const fromTop = edge === "top";
	return (
		<ToastPrimitive.Root
			ref={ref}
			data-slot="toast"
			// Swipe dismissal is constrained per position — top stacks dismiss upward,
			// bottom stacks downward (overridable via props for custom setups).
			swipeDirection={TOAST_EDGE_SWIPE[edge]}
			className={cn(
				"pointer-events-auto absolute z-[calc(1000-var(--toast-index))] w-full rounded-xl border bg-popover text-popover-foreground shadow-lg will-change-transform outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
				// Anchor the card to the viewport's vertical edge so it grows INTO the
				// screen (bottom = upward, top = downward) instead of past it.
				fromTop ? "top-0" : "bottom-0",
				"[--gap:0.75rem] [--height:var(--toast-frontmost-height,var(--toast-height))] [--offset-y:calc(var(--toast-offset-y)*-1+calc(var(--toast-index)*var(--gap)*-1)+var(--toast-swipe-movement-y))] [--peek:0.75rem] [--scale:calc(max(0,1-(var(--toast-index)*0.1)))] [--shrink:calc(1-var(--scale))]",
				"h-(--height) transform-[translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)-(var(--toast-index)*var(--peek))-(var(--shrink)*var(--height))))_scale(var(--scale))] [transition:transform_500ms_var(--ease-overlay-emphasized),opacity_500ms,height_150ms]",
				"after:absolute after:inset-s-0 after:top-full after:h-[calc(var(--gap)+1px)] after:w-full after:content-['']",
				"data-expanded:h-(--toast-height) data-expanded:transform-[translateX(var(--toast-swipe-movement-x))_translateY(var(--offset-y))]",
				fromTop ? "origin-top" : "origin-bottom",
				fromTop
					? "data-starting-style:transform-[translateY(-150%)] [&[data-ending-style]:not([data-limited]):not([data-swipe-direction])]:transform-[translateY(-150%)]"
					: "data-starting-style:transform-[translateY(150%)] [&[data-ending-style]:not([data-limited]):not([data-swipe-direction])]:transform-[translateY(150%)]",
				"data-ending-style:data-[swipe-direction=down]:transform-[translateY(calc(var(--toast-swipe-movement-y)+150%))]",
				"data-ending-style:data-[swipe-direction=left]:transform-[translateX(calc(var(--toast-swipe-movement-x)-150%))_translateY(var(--offset-y))]",
				"data-ending-style:data-[swipe-direction=right]:transform-[translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))]",
				"data-ending-style:data-[swipe-direction=up]:transform-[translateY(calc(var(--toast-swipe-movement-y)-150%))]",
				"data-expanded:data-ending-style:data-[swipe-direction=down]:transform-[translateY(calc(var(--toast-swipe-movement-y)+150%))]",
				"data-expanded:data-ending-style:data-[swipe-direction=left]:transform-[translateX(calc(var(--toast-swipe-movement-x)-150%))_translateY(var(--offset-y))]",
				"data-expanded:data-ending-style:data-[swipe-direction=right]:transform-[translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))]",
				"data-expanded:data-ending-style:data-[swipe-direction=up]:transform-[translateY(calc(var(--toast-swipe-movement-y)-150%))]",
				"motion-reduce:transition-none",
				className,
			)}
			{...props}
		/>
	);
});

const ToastContent = React.forwardRef<HTMLDivElement, ToastPrimitive.Content.Props>(function ToastContent({ className, ...props }, ref): React.JSX.Element {
	return (
		<ToastPrimitive.Content
			ref={ref}
			data-slot="toast-content"
			className={cn(
				"flex h-full items-center gap-3 overflow-hidden p-4 transition-opacity duration-250 ease-(--ease-overlay-emphasized) data-behind:opacity-0 data-expanded:opacity-100",
				className,
			)}
			{...props}
		/>
	);
});

const ToastTitle = React.forwardRef<HTMLHeadingElement, ToastPrimitive.Title.Props>(function ToastTitle({ className, ...props }, ref): React.JSX.Element {
	return <ToastPrimitive.Title ref={ref} data-slot="toast-title" className={cn("text-sm font-medium", className)} {...props} />;
});

const ToastDescription = React.forwardRef<HTMLParagraphElement, ToastPrimitive.Description.Props>(function ToastDescription({ className, ...props }, ref): React.JSX.Element {
	return <ToastPrimitive.Description ref={ref} data-slot="toast-description" className={cn("text-sm text-muted-foreground", className)} {...props} />;
});

// Default render targets hoisted to module scope so each render reuses one element.
const TOAST_ACTION_BUTTON = <Button variant="outline" size="sm" />;
const TOAST_CLOSE_BUTTON = (
	<Button variant="ghost" size="icon-lg" className="hover:bg-transparent hover:text-inherit aria-expanded:bg-transparent dark:hover:bg-transparent" />
);

const ToastAction = React.forwardRef<HTMLButtonElement, ToastPrimitive.Action.Props>(function ToastAction(
	{ className, render = TOAST_ACTION_BUTTON, ...props },
	ref,
): React.JSX.Element {
	return <ToastPrimitive.Action ref={ref} data-slot="toast-action" render={render} className={cn("shrink-0", className)} {...props} />;
});

export interface ToastCloseProps extends ToastPrimitive.Close.Props {
	/** Accessible name for the close button (improvement 4 — i18n). @default labels.close */
	readonly closeLabel?: string;
}

const ToastClose = React.forwardRef<HTMLButtonElement, ToastCloseProps>(function ToastClose(
	{ className, children, closeLabel, render = TOAST_CLOSE_BUTTON, ...props },
	ref,
): React.JSX.Element {
	const labels = useToastLabels();
	return (
		<ToastPrimitive.Close
			ref={ref}
			data-slot="toast-close"
			aria-label={closeLabel ?? labels.close}
			render={render}
			className={cn("relative min-h-11 min-w-11 shrink-0 text-muted-foreground after:absolute after:-inset-2 after:content-[''] sm:min-h-0 sm:min-w-0", className)}
			{...props}>
			{children ?? <XIcon aria-hidden="true" />}
		</ToastPrimitive.Close>
	);
});

// ── Icon (improvement 1 + 2 + feature 13) ───────────────────────────────────

export interface ToastIconProps extends Omit<React.ComponentProps<"span">, "children"> {
	/** The toast type driving the default icon (zod-inferred). */
	readonly type: ToastType | undefined;
	/** Optional override — wins over the type default (feature 13). */
	readonly icon?: ReactNode;
}

const ToastIcon = React.forwardRef<HTMLSpanElement, ToastIconProps>(function ToastIcon({ type, icon, className, ...props }, ref): React.JSX.Element | null {
	let content: ReactNode = icon;
	if (icon === undefined) {
		if (type === undefined) {
			return null;
		}
		const IconComponent = TOAST_TYPE_ICONS[type];
		content = <IconComponent className={cn(type === "loading" ? "animate-spin" : undefined, TOAST_TYPE_STYLES[type].icon)} aria-hidden="true" />;
	}

	return (
		<span ref={ref} data-slot="toast-icon" className={cn("shrink-0 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4", className)} {...props}>
			{content}
		</span>
	);
});

// ── Progress bar (feature 12) ───────────────────────────────────────────────

export interface ToastProgressProps extends Omit<React.ComponentProps<"div">, "children"> {
	/** 0–100 progress value. */
	readonly value: number;
}

const ToastProgress = React.forwardRef<HTMLDivElement, ToastProgressProps>(function ToastProgress({ value, className, ...props }, ref): React.JSX.Element {
	const clamped = Math.min(PROGRESS_MAX, Math.max(PROGRESS_MIN, value));
	const barStyle = useMemo<React.CSSProperties>(() => ({ width: `${String(clamped)}%` }), [clamped]);
	return (
		// The 1rem-tall wrapper carries the card's real corner radius (16px on a 4px bar
		// would be clamped to 4px and poke past the rounded border) and clips the bar.
		<div
			ref={ref}
			data-slot="toast-progress"
			role="progressbar"
			aria-valuemin={PROGRESS_MIN}
			aria-valuemax={PROGRESS_MAX}
			aria-valuenow={clamped}
			className={cn("pointer-events-none absolute inset-x-0 bottom-0 h-4 overflow-hidden rounded-b-xl", className)}
			{...props}>
			<div className="absolute inset-x-0 bottom-0 h-1 bg-muted">
				<div className="h-full bg-primary transition-[width] duration-300" style={barStyle} />
			</div>
		</div>
	);
});

// ── Auto-dismiss countdown (feature 6/12) ───────────────────────────────────
// Drains from 100% → 0% over the toast's auto-dismiss duration (default 5s),
// pausing while the toast is hovered/expanded to match base-ui's timer pause.
// Manual `data.progress` replaces it (see ToastRow).

export interface ToastCountdownProps extends Omit<React.ComponentProps<"div">, "children" | "className"> {
	/** Auto-dismiss duration in ms — the bar drains over this. */
	readonly duration: number;
	/** Freezes the bar — mirrors the conditions under which base-ui pauses its
	 *  dismiss timer (hover/focus on the card, window blur). @default false */
	readonly paused?: boolean | undefined;
	/** Tint for the draining bar (per-type token class). */
	readonly className?: string | undefined;
}

const ToastCountdown = React.forwardRef<HTMLDivElement, ToastCountdownProps>(function ToastCountdown(
	{ duration, paused = false, className, ...props },
	ref,
): React.JSX.Element {
	const drainStyle = useMemo<React.CSSProperties>(() => ({ animation: `toast-countdown ${String(duration)}ms linear forwards` }), [duration]);
	return (
		// 1rem-tall clipping wrapper: a 16px radius on the 4px bar would be clamped to 4px
		// and overflow the card's rounded corners, so the wrapper (radius matches the card)
		// clips the bar to the exact corner curve. The top 12px is transparent padding.
		<div ref={ref} data-slot="toast-countdown" aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-4 overflow-hidden rounded-b-xl" {...props}>
			<div className="absolute inset-x-0 bottom-0 h-1 bg-muted/60">
				<div
					className={cn(
						// `bg-foreground/25` is the neutral fallback for untyped toasts; the per-type
						// tint (className) overrides it. The `!` important beats the inline animation
						// shorthand for both pauses AND prefers-reduced-motion (inline styles win
						// over any non-important stylesheet rule — the old group-hover classes below
						// silently lost that battle, so the pause is JS-driven via `paused` instead).
						"h-full w-full bg-foreground/25 motion-reduce:animate-none!",
						paused ? "paused!" : undefined,
						className,
					)}
					style={drainStyle}
				/>
			</div>
		</div>
	);
});

// ── Ticking countdown label (feature 19) ────────────────────────────────────
// A tiny "Dismisses in Xs" readout under the content that ticks down in sync
// with the countdown bar and the real auto-dismiss timer. It freezes while the
// card is hovered/focused — the exact conditions under which base-ui pauses its
// own timer (store: `expanded = hovering || focused`) — so the text never drifts
// from the bar. The copy is supplied by the smart component (i18n-ready).

/**
 * Ticks down from `duration` ms toward 0 in ~100ms increments, frozen while
 * `paused` and inert while `enabled` is false (no countdown rendered — e.g.
 * loading/persistent/progress toasts, so they never re-render on a timer).
 * Delta-based: each tick subtracts only the wall-clock time that elapsed
 * *while the interval was running*, so a pause freezes the remaining time
 * exactly (an absolute end-timestamp can't do this — the clock keeps moving
 * during the pause). All ref access lives inside the interval callback or
 * effect — never during render (React Compiler rules).
 */
function useCountdown(duration: number, paused: boolean, enabled: boolean): number {
	const [remainingMs, setRemainingMs] = useState<number>(duration);
	const remainingRef = useRef<number>(duration);
	const lastDurationRef = useRef<number>(duration);
	// True between a pause and its resume — lets us mirror base-ui's resume rule
	// (a timer that fully elapsed while paused restarts at its full delay).
	const wasPausedRef = useRef<boolean>(false);

	useEffect(() => {
		// While disabled (no countdown rendered) keep the refs in sync with the
		// current duration so an enable — e.g. `toast.update` flipping a
		// loading/progress toast into an auto-dismissing one — starts accurate.
		if (!enabled) {
			if (lastDurationRef.current !== duration) {
				lastDurationRef.current = duration;
				remainingRef.current = duration;
			}
			wasPausedRef.current = paused;
			return;
		}
		// While paused there is no ticker — the refs keep their frozen values, so
		// the countdown resumes exactly where it left off.
		if (paused) {
			wasPausedRef.current = true;
			return;
		}
		// Resuming after a pause: if the remaining time ran out while paused,
		// base-ui restarts the timer from its FULL delay (`remaining = remaining > 0
		// ? remaining : delay` in `resumeTimers`) — restart the label identically,
		// or it would read "0s" while the toast lives another full round.
		if (wasPausedRef.current && remainingRef.current <= 0) {
			remainingRef.current = duration;
			setRemainingMs(duration);
		}
		wasPausedRef.current = false;
		let last = Date.now();
		const id = window.setInterval(() => {
			const now = Date.now();
			const elapsed = now - last;
			last = now;
			// Reset only when the duration actually changed (e.g. `toast.update`);
			// pause/resume must NOT reset it. The reset tick skips the decrement so
			// the new countdown starts at its exact full duration.
			if (lastDurationRef.current !== duration) {
				lastDurationRef.current = duration;
				remainingRef.current = duration;
			} else {
				remainingRef.current = Math.max(0, remainingRef.current - elapsed);
			}
			setRemainingMs(remainingRef.current);
		}, COUNTDOWN_TICK_MS);
		return (): void => {
			window.clearInterval(id);
		};
	}, [duration, paused, enabled]);

	return remainingMs;
}

export interface ToastCountdownLabelProps extends Omit<React.ComponentProps<"span">, "children"> {
	/** Remaining time before auto-dismiss, in ms. */
	readonly remainingMs: number;
	/** Renders the copy for a whole number of seconds remaining (i18n). */
	readonly format: (seconds: number) => ReactNode;
}

/** Small muted "Dismisses in 4s" readout — `tabular-nums` so digits don't jitter. */
const ToastCountdownLabel = React.forwardRef<HTMLSpanElement, ToastCountdownLabelProps>(function ToastCountdownLabel(
	{ remainingMs, format, className, ...props },
	ref,
): React.JSX.Element {
	// Never reads "0s" while the toast is still on screen — the last second shows as 1s.
	const seconds = Math.max(1, Math.ceil(remainingMs / MS_PER_SECOND));
	return (
		<span
			ref={ref}
			data-slot="toast-countdown-label"
			className={cn("text-(length:--text-toast-countdown) leading-none text-muted-foreground tabular-nums", className)}
			{...props}>
			{format(seconds)}
		</span>
	);
});

// ── List (improvement 6: per-row memo; improvement 16: progress bar) ────────

interface ToastRowProps {
	readonly toastItem: ToastObject<ToastData>;
}

/** Base-ui's promise toast options (not re-exported from the parts index). */
export interface ToastPromiseOptions<Value, TData extends object> {
	readonly loading: string | ToastObject<TData>;
	readonly success: string | ToastObject<TData> | ((result: Value) => string | ToastObject<TData>);
	readonly error: string | ToastObject<TData> | ((error: Error) => string | ToastObject<TData>);
}

const ToastRow = memo(function ToastRow({ toastItem }: ToastRowProps): React.JSX.Element {
	// Validate the manager-supplied type against the schema (no casts — rule 4).
	const parsedType = toastItem.type !== undefined ? toastTypeSchema.safeParse(toastItem.type) : undefined;
	const type: ToastType | undefined = parsedType?.success === true ? parsedType.data : undefined;
	const data = toastItem.data;
	const defaultTimeout = useToastTimeout();
	const duration = toastItem.timeout ?? defaultTimeout;
	const labels = useToastLabels();
	// Shared pause: base-ui freezes EVERY toast's dismiss timer when ANY toast is
	// hovered/focused (viewport-wide) or the window blurs — mirror it so the
	// label ticks and the real dismissal never drift apart.
	const { paused, setHovered, setFocused } = useToastInteraction();

	// Countdown (bar + label) shows for every auto-dismissing, non-loading toast
	// that isn't driving a manual progress bar. Computed before the hooks below
	// so `useCountdown` can be disabled when nothing is rendered.
	const showCountdown = data?.progress === undefined && type !== "loading" && duration > 0;

	// The card pauses auto-dismiss while hovered/focused (base-ui: `expanded =
	// hovering || focused`) AND while the window is blurred (base-ui pauses its
	// timer on window blur), so the label ticker + bar freeze under the exact
	// same conditions to stay in sync with the real dismissal.
	const handleMouseEnter = useCallback((): void => {
		setHovered(true);
	}, [setHovered]);
	const handleMouseLeave = useCallback((): void => {
		setHovered(false);
	}, [setHovered]);
	const handleFocus = useCallback((): void => {
		setFocused(true);
	}, [setFocused]);
	const handleBlur = useCallback((): void => {
		setFocused(false);
	}, [setFocused]);
	const remainingMs = useCountdown(duration, paused, showCountdown);

	return (
		<Toast
			toast={toastItem}
			className={type !== undefined ? TOAST_TYPE_STYLES[type].card : undefined}
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}
			onFocus={handleFocus}
			onBlur={handleBlur}>
			<ToastContent>
				<ToastIcon type={type} icon={data?.icon} />
				<div className="flex min-w-0 flex-1 flex-col gap-1">
					<ToastTitle>{toastItem.title}</ToastTitle>
					{toastItem.description !== undefined ? <ToastDescription>{toastItem.description}</ToastDescription> : null}
					{showCountdown ? <ToastCountdownLabel remainingMs={remainingMs} format={labels.countdown} /> : null}
				</div>
				{/* Render the action bare — base-ui auto-merges `toast.actionProps` into the
				    button props itself (props array `[elementProps, toast.actionProps, ...]`).
				    Spreading them here as well would merge `onClick` twice and double-fire. */}
				{toastItem.actionProps !== undefined ? <ToastAction /> : null}
				<ToastClose />
			</ToastContent>
			{data?.progress !== undefined ? (
				<ToastProgress value={data.progress} />
			) : showCountdown ? (
				<ToastCountdown duration={duration} paused={paused} className={type !== undefined ? TOAST_TYPE_STYLES[type].countdown : undefined} />
			) : null}
		</Toast>
	);
});

function ToastList(): React.JSX.Element[] {
	const { toasts } = ToastPrimitive.useToastManager<ToastData>();
	return toasts.map((toastItem) => <ToastRow key={toastItem.id} toastItem={toastItem} />);
}

// ── Toaster (improvement 6: per-row memo lives in ToastRow) ──────────────────

export interface ToasterProps extends ToastPrimitive.Provider.Props {
	/** Override the manager (multi-manager isolation — feature 17). */
	readonly toastManager?: ToastPrimitive.Provider.Props["toastManager"];
	/** Maximum visible toasts before the oldest are limited (feature 10). */
	readonly limit?: number;
	/** Where the toast stack appears (feature 11). @default "bottom-right" */
	readonly position?: ToastPosition;
	/** Per-usage overrides of the `toast` copy from `UiKitLabelsProvider`. */
	readonly labels?: UiKitLabelsOverride<"toast"> | undefined;
	/** Countdown-label copy renderer (feature 19 — i18n) — shorthand that overrides `labels.countdown`. */
	readonly countdownLabel?: ((seconds: number) => ReactNode) | undefined;
}

// Mount exactly ONE <Toaster /> per manager — a second instance bound to the
// same manager renders a duplicate viewport showing the same toasts.
function Toaster({
	children,
	toastManager = toast,
	limit = DEFAULT_TOAST_LIMIT,
	position = "bottom-right",
	labels,
	countdownLabel,
	...props
}: ToasterProps): React.JSX.Element {
	return (
		<ToastProvider toastManager={toastManager} limit={limit} labels={labels} countdownLabel={countdownLabel} {...props}>
			{children}
			<ToastPortal>
				<ToastViewport position={position}>
					<ToastList />
				</ToastViewport>
			</ToastPortal>
		</ToastProvider>
	);
}

// ── Typed imperative helpers (feature 17/18) ────────────────────────────────
// Thin wrappers over the raw manager so call sites get zod-typed `type` and a
// fluent `toastMessage.success({...})` API. `toast` (the raw manager) stays
// exported for advanced use (update/promise/multi-manager).

export interface ToastMessageOptions {
	readonly title?: ReactNode;
	readonly description?: ReactNode;
	/** Auto-dismiss after N ms; `0` disables (feature 6). @default DEFAULT_TOAST_TIMEOUT_MS (5000) */
	readonly timeout?: number;
	/** aria-live urgency (feature 9). Defaults from the type. */
	readonly priority?: "low" | "high";
	/** Action button props (feature 5). */
	readonly actionProps?: React.ComponentPropsWithoutRef<"button"> & { readonly onClick?: () => void };
	/** Custom payload (progress bar / icon override). */
	readonly data?: ToastData;
	/** Fired when the toast closes. */
	readonly onClose?: () => void;
}

interface ToastMessageApi {
	readonly success: (options: ToastMessageOptions) => string;
	readonly info: (options: ToastMessageOptions) => string;
	readonly warning: (options: ToastMessageOptions) => string;
	readonly error: (options: ToastMessageOptions) => string;
	readonly loading: (options: ToastMessageOptions) => string;
	readonly dismiss: (id?: string) => void;
	readonly update: (id: string, updates: Partial<ToastObject<ToastData>>) => void;
	readonly promise: <Value>(promiseValue: Promise<Value>, options: ToastPromiseOptions<Value, ToastData>) => Promise<Value>;
}

/**
 * Builds the typed helper API bound to a specific manager. The exported
 * `toastMessage` is bound to the default singleton; tests and multi-manager
 * apps use `createToastMessage(manager)` for isolation (feature 17).
 */
function createToastMessage(manager: ToastPrimitive.Provider.Props["toastManager"] = toast): ToastMessageApi {
	/** One typed `add` per toast type; the priority defaults from the type. */
	const add =
		(type: ToastType): ((options: ToastMessageOptions) => string) =>
		(options: ToastMessageOptions): string =>
			manager.add({ ...options, type, priority: options.priority ?? TOAST_TYPE_PRIORITY[type] });

	return {
		success: add("success"),
		info: add("info"),
		warning: add("warning"),
		error: add("error"),
		loading: add("loading"),
		/** Dismiss one toast by id, or all when omitted (feature 7). */
		dismiss(id?: string): void {
			manager.close(id);
		},
		/** Patch a live toast in place (feature 8). */
		update(id: string, updates: Partial<ToastObject<ToastData>>): void {
			manager.update(id, updates);
		},
		/** Render loading → success/error automatically from a promise (feature 18). */
		promise<Value>(promiseValue: Promise<Value>, options: ToastPromiseOptions<Value, ToastData>): Promise<Value> {
			return manager.promise(promiseValue, options);
		},
	};
}

/** Typed helpers bound to the default singleton manager. */
const toastMessage = createToastMessage();

// ── a11y helper (improvement 10 + feature 16) ───────────────────────────────

export interface ToastA11yProps {
	readonly role: "status" | "alert";
	readonly priority: "low" | "high";
	readonly label: string;
}

/**
 * Computes the ARIA contract for a toast type — reuse in tests and docs. The
 * caller supplies the `toast` copy (e.g. from `useToastLabels()`), since this
 * plain helper cannot read the labels provider itself.
 */
export function toastA11yProps(type: ToastType, labels: ToastLabels, customLabel?: string): ToastA11yProps {
	const priority = TOAST_TYPE_PRIORITY[type];
	return {
		role: priority === "high" ? "alert" : "status",
		priority,
		label: customLabel ?? (priority === "high" ? labels.errorAnnouncement : labels.notificationAnnouncement),
	};
}

const createToastManager = ToastPrimitive.createToastManager;
const useToastManager = ToastPrimitive.useToastManager;
export {
	Toaster,
	Toast,
	ToastAction,
	ToastClose,
	ToastContent,
	ToastCountdown,
	ToastCountdownLabel,
	ToastDescription,
	ToastIcon,
	ToastPortal,
	ToastProgress,
	ToastProvider,
	ToastTitle,
	ToastViewport,
	createToastManager,
	createToastMessage,
	toast,
	toastMessage,
	toastDataSchema,
	toastPositionSchema,
	toastTypeSchema,
	useToastLabels,
	useToastManager,
	useToastPosition,
	type ToastData,
	type ToastObject,
	type ToastPosition,
	type ToastType,
};
