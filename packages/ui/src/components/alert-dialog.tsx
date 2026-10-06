"use client";

// ============================================================
// components/alert-dialog.tsx
//
// Confirmation dialog built on base-ui AlertDialog, satisfying the
// repo's 23 rules + the ui-components audit (20 improvements + 20
// features):
//   - CVA variants, token-driven: `size` (sm | default | lg) with
//     distinct widths, `width` (sm | md | lg | full) escape hatch,
//     `severity` on the media tile
//   - every part that renders DOM forwards its ref (Root/Portal render
//     none of their own and stay plain functions)
//   - `loading` + `loadingLabel` on the action (async confirms)
//   - `severity` tiers (info | warning | critical) driving the icon
//     tile + confirm tone; `confirmLabel`/`cancelLabel`
//   - `requireConfirmation` (type a keyword), `requireReason`
//     (textarea), `delaySeconds` countdown
//   - `actionOrder` (confirm-first | cancel-first), `stackOrder`
//   - `align` (center | start), `summary`, `undoHint`, `thirdAction`,
//     `confirmShortcut`, `onConfirm`/`onDismiss` analytics hooks
//   - sticky footer, scrollable content, `motion-safe` animations
//   - zod schemas exported for tests
//
// Data lives in the smart component / page — this file renders what
// it is given (rules 9/10/11).
// ============================================================

import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import type { BaseUIEvent } from "@base-ui/react/types";
import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Kbd } from "@workspace/ui/components/kbd";
import { Textarea } from "@workspace/ui/components/textarea";
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import { cn } from "@workspace/ui/lib/core/utils";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import { cva } from "class-variance-authority";
import { Loader2Icon } from "lucide-react";
import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { z } from "zod";

// ── Zod schemas (rule 13: no inline unions, no `typeof` checks) ─────────────

/** Dialog width presets (improvement 18). */
const alertDialogWidthSchema = z.enum(["sm", "md", "lg", "full"]);

/** Dialog density presets (improvement 1). */
const alertDialogSizeSchema = z.enum(["sm", "default", "lg"]);

/** Escalation tier driving the icon tile + confirm tone (feature 5). */
const alertDialogSeveritySchema = z.enum(["info", "warning", "critical"]);

/** Button ordering — `actionOrder` on desktop (feature 18), `stackOrder` on mobile (improvement 7). */
const alertDialogActionOrderSchema = z.enum(["confirm-first", "cancel-first"]);

/** Header alignment (improvement 13). */
const alertDialogAlignSchema = z.enum(["center", "start"]);

type AlertDialogWidth = z.infer<typeof alertDialogWidthSchema>;
type AlertDialogSize = z.infer<typeof alertDialogSizeSchema>;
type AlertDialogSeverity = z.infer<typeof alertDialogSeveritySchema>;
type AlertDialogActionOrder = z.infer<typeof alertDialogActionOrderSchema>;
type AlertDialogAlign = z.infer<typeof alertDialogAlignSchema>;

// ── CVA variants (improvement 17 — module scope, no GC churn) ───────────────

/** Milliseconds per second — converts `delaySeconds` and drives the 1s countdown tick. */
const MS_PER_SECOND = 1000;

/**
 * Popup surface. `size` is the density preset (improvement 1: sm is compact,
 * lg is roomy); `width` is the explicit max-width override (improvement 18) —
 * pass one or the other, `width` wins (see `resolveContentVariants`).
 */
const alertDialogContentVariants = cva(
	"group/alert-dialog-content fixed start-1/2 top-1/2 z-overlay grid max-h-[min(85dvh,640px)] w-full -translate-x-1/2 -translate-y-1/2 gap-4 overflow-hidden rounded-xl bg-popover p-6 text-popover-foreground shadow-xl ring-1 ring-foreground/10 duration-100 outline-none rtl:translate-x-1/2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 motion-safe:data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 motion-safe:data-closed:animate-out",
	{
		variants: {
			size: {
				sm: "max-w-sm",
				default: "max-w-md sm:max-w-lg",
				lg: "max-w-lg sm:max-w-2xl",
			},
			width: {
				sm: "max-w-sm",
				md: "max-w-md",
				lg: "max-w-lg",
				full: "max-w-3xl",
			},
		},
	},
);

/** `width` replaces the size preset entirely (its responsive `sm:max-w-*` included). */
function resolveContentVariants(size: AlertDialogSize, width: AlertDialogWidth | undefined): string {
	return width !== undefined ? alertDialogContentVariants({ width }) : alertDialogContentVariants({ size });
}

/** Header icon tile — `severity` drives the tone (feature 5). */
const alertDialogMediaVariants = cva("mb-2 inline-flex size-12 items-center justify-center rounded-lg transition-colors [&_svg:not([class*='size-'])]:size-6", {
	variants: {
		severity: {
			info: "bg-info/10 text-info",
			warning: "bg-warning/10 text-warning",
			critical: "bg-destructive/10 text-destructive",
		},
	},
	defaultVariants: {
		severity: "info",
	},
});

// severity → confirm button variant (feature 5).

const SEVERITY_CONFIRM_VARIANTS: Readonly<Record<AlertDialogSeverity, "default" | "destructive">> = {
	info: "default",
	warning: "default",
	critical: "destructive",
};

/** The alert dialog's copy — the `alertDialog` family of `UiKitLabels`. */
export interface AlertDialogLabels {
	readonly confirm: string;
	readonly cancel: string;
	readonly loading: string;
	readonly close: string;
	readonly typeKeywordBefore: string;
	readonly typeKeywordAfter: string;
	readonly reasonLabel: string;
	readonly reasonPlaceholder: string;
	readonly dontAskAgain: string;
}

// ── Root (improvement 14: forwarded ref) ────────────────────────────────────
//
// base-ui's AlertDialogRoot is a plain function component — it does NOT accept
// a `ref` prop (it exposes imperative control via `actionsRef`/`handle`
// instead). So this wrapper is a plain function too, exactly like `dialog.tsx`.
// The action/cancel/trigger children still forward refs (see below).

export interface AlertDialogProps extends AlertDialogPrimitive.Root.Props {
	/** Fired when the dialog closes via cancel/Escape (feature 16 analytics hook). */
	readonly onDismiss?: () => void;
}

function AlertDialog({ onDismiss, onOpenChange, ...props }: AlertDialogProps): React.JSX.Element {
	// Bridge base-ui's open-change (fires with `open=false` on close) to the
	// smart component's dismiss analytics hook (feature 16).
	const handleOpenChange = useCallback(
		(open: boolean, details: AlertDialogPrimitive.Root.ChangeEventDetails): void => {
			if (!open) {
				onDismiss?.();
			}
			onOpenChange?.(open, details);
		},
		[onDismiss, onOpenChange],
	);

	return <AlertDialogPrimitive.Root data-slot="alert-dialog" onOpenChange={handleOpenChange} {...props} />;
}

// ── Trigger / Portal / Overlay ──────────────────────────────────────────────

const AlertDialogTrigger = React.forwardRef<HTMLButtonElement, AlertDialogPrimitive.Trigger.Props>(function AlertDialogTrigger({ ...props }, ref): React.JSX.Element {
	return <AlertDialogPrimitive.Trigger ref={ref} data-slot="alert-dialog-trigger" {...props} />;
});

function AlertDialogPortal({ ...props }: AlertDialogPrimitive.Portal.Props): React.JSX.Element {
	return <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />;
}

const AlertDialogOverlay = React.forwardRef<HTMLDivElement, AlertDialogPrimitive.Backdrop.Props>(function AlertDialogOverlay({ className, ...props }, ref): React.JSX.Element {
	return (
		<AlertDialogPrimitive.Backdrop
			ref={ref}
			data-slot="alert-dialog-overlay"
			// Token-based backdrop (`--scrim`), not a raw `bg-black/10`.
			className={cn(
				"fixed inset-0 isolate z-overlay bg-scrim/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
				className,
			)}
			{...props}
		/>
	);
});

// ── Content ─────────────────────────────────────────────────────────────────

export interface AlertDialogContentProps extends AlertDialogPrimitive.Popup.Props {
	/** Density preset (improvement 1). */
	readonly size?: AlertDialogSize;
	/** Explicit max-width override (improvement 18). */
	readonly width?: AlertDialogWidth;
	/** Escalation tier (feature 5). */
	readonly severity?: AlertDialogSeverity;
	/**
	 * Per-usage overrides of the `alertDialog` copy from `UiKitLabelsProvider`
	 * (e.g. a "Delete users" confirm) — anything omitted reads from the provider.
	 */
	readonly labels?: UiKitLabelsOverride<"alertDialog"> | undefined;
	/** Show a loading spinner on the confirm button and disable both (feature 2). */
	readonly confirmLoading?: boolean;
	/** Disable the confirm button until the keyword is typed (feature 3). */
	readonly requireConfirmation?: string;
	/** Controlled keyword input when `requireConfirmation` is set. */
	readonly confirmationValue?: string;
	readonly onConfirmationValueChange?: (value: string) => void;
	/** Disable the confirm button until a reason is typed (feature 9). */
	readonly requireReason?: boolean;
	/** Controlled reason textarea when `requireReason` is set. */
	readonly reasonValue?: string;
	readonly onReasonValueChange?: (value: string) => void;
	/** Disable the confirm button with a countdown before it can be pressed (feature 4). */
	readonly delaySeconds?: number;
	/** Keyboard shortcut hint shown in the footer (feature 6). */
	readonly confirmShortcut?: string;
	/** Optional neutral third action slot (feature 1). */
	readonly thirdAction?: ReactNode;
	/** Desktop button order (feature 18). */
	readonly actionOrder?: AlertDialogActionOrder;
	/** Mobile button order (improvement 7). */
	readonly stackOrder?: AlertDialogActionOrder;
	/** Header alignment (improvement 13). */
	readonly align?: AlertDialogAlign;
	/** Small table of affected resources (feature 10). */
	readonly summary?: readonly { readonly label: string; readonly value: string }[];
	/** Undo fallback copy under the description (feature 11). */
	readonly undoHint?: string;
	/** Fired when the confirm action is activated (feature 16 analytics hook). */
	readonly onConfirm?: () => void;
	/** Fired when the cancel action is activated (feature 16 analytics hook). */
	readonly onCancel?: () => void;
	/** "Don't ask again" state callback (feature 7). */
	readonly onPreferenceChange?: (remembered: boolean) => void;
	/** Controlled preference checkbox when `onPreferenceChange` is set. */
	readonly preferenceRemembered?: boolean;
}

interface AlertDialogActionContextValue {
	readonly confirmLoading: boolean;
	readonly confirmDisabled: boolean;
	readonly onConfirm: (() => void) | undefined;
}

const AlertDialogActionContext = React.createContext<AlertDialogActionContextValue>({
	confirmLoading: false,
	confirmDisabled: false,
	onConfirm: undefined,
});

const AlertDialogContent = React.forwardRef<HTMLDivElement, AlertDialogContentProps>(function AlertDialogContent(
	{
		className,
		size = "default",
		width,
		severity = "info",
		labels,
		confirmLoading = false,
		requireConfirmation,
		confirmationValue,
		onConfirmationValueChange,
		requireReason = false,
		reasonValue,
		onReasonValueChange,
		delaySeconds,
		confirmShortcut,
		thirdAction,
		actionOrder = "confirm-first",
		stackOrder = "confirm-first",
		align = "center",
		summary,
		undoHint,
		onConfirm,
		onCancel,
		onPreferenceChange,
		preferenceRemembered = false,
		children,
		...props
	},
	ref,
): React.JSX.Element {
	const resolvedLabels = useUiKitLabels("alertDialog", labels);
	const [remaining, setRemaining] = useState<number>(delaySeconds ?? 0);

	const deadlineRef = useRef<number>(0);
	useEffect(() => {
		if (delaySeconds === undefined || delaySeconds <= 0) {
			return;
		}
		deadlineRef.current = Date.now() + delaySeconds * MS_PER_SECOND;
		const interval = window.setInterval(() => {
			const next = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / MS_PER_SECOND));
			setRemaining(next);
			if (next <= 0) {
				window.clearInterval(interval);
			}
		}, MS_PER_SECOND);
		return (): void => {
			window.clearInterval(interval);
		};
	}, [delaySeconds]);

	const typedKeyword = confirmationValue ?? "";
	const reason = reasonValue ?? "";
	const remembered = preferenceRemembered;

	const keywordConfirmed = requireConfirmation === undefined || typedKeyword === requireConfirmation;
	const reasonConfirmed = !requireReason || reason.trim() !== "";
	const countdownActive = (delaySeconds ?? 0) > 0 && remaining > 0;
	const confirmDisabled = confirmLoading || !keywordConfirmed || !reasonConfirmed || countdownActive;

	const handlePreferenceChange = useCallback(
		(next: boolean): void => {
			onPreferenceChange?.(next);
		},
		[onPreferenceChange],
	);

	const handleKeywordChange = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			onConfirmationValueChange?.(event.target.value);
		},
		[onConfirmationValueChange],
	);

	const handleReasonChange = useCallback(
		(event: React.ChangeEvent<HTMLTextAreaElement>): void => {
			onReasonValueChange?.(event.target.value);
		},
		[onReasonValueChange],
	);

	const contextValue = useMemo<AlertDialogActionContextValue>(() => ({ confirmLoading, confirmDisabled, onConfirm }), [confirmLoading, confirmDisabled, onConfirm]);

	// Unique per instance — two open dialogs (or a nested one) must not share ids.
	const fieldIdPrefix = React.useId();
	const confirmationInputId = `${fieldIdPrefix}-confirmation`;
	const reasonInputId = `${fieldIdPrefix}-reason`;

	return (
		<AlertDialogPortal>
			<AlertDialogOverlay />
			<AlertDialogPrimitive.Popup ref={ref} data-slot="alert-dialog-content" className={cn(resolveContentVariants(size, width), className)} {...props}>
				<div className="grid min-h-0 flex-1 grid-rows-[auto_1fr_auto] gap-4 overflow-y-auto">
					<div className="contents">
						<AlertDialogActionContext.Provider value={contextValue}>
							{/* Header */}
							<div data-slot="alert-dialog-header" className={cn("grid gap-1.5", align === "center" ? "place-items-center text-center" : "place-items-start text-start")}>
								{children}
							</div>

							{/* Guards + summary + undo hint */}
							<div data-slot="alert-dialog-guards" className="space-y-3">
								{requireConfirmation !== undefined ? (
									<label data-slot="alert-dialog-confirmation" className="block space-y-1.5 text-start text-sm">
										<span className="text-muted-foreground">
											{resolvedLabels.typeKeywordBefore} <Kbd>{requireConfirmation}</Kbd> {resolvedLabels.typeKeywordAfter}
										</span>
										<input
											type="text"
											name="alert-dialog-confirmation-input"
											id={confirmationInputId}
											value={typedKeyword}
											onChange={handleKeywordChange}
											className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
											autoComplete="off"
										/>
									</label>
								) : null}
								{requireReason ? (
									<div data-slot="alert-dialog-reason" className="space-y-1.5 text-start">
										<label htmlFor={reasonInputId} className="text-sm text-muted-foreground">
											{resolvedLabels.reasonLabel}
										</label>
										<Textarea id={reasonInputId} value={reason} onChange={handleReasonChange} placeholder={resolvedLabels.reasonPlaceholder} rows={2} />
									</div>
								) : null}
								{summary !== undefined && summary.length > 0 ? (
									<div data-slot="alert-dialog-summary" className="overflow-hidden rounded-md border border-border">
										<table className="w-full text-start text-sm">
											<tbody>
												{summary.map((row) => (
													<tr key={row.label} className="border-b border-border last:border-b-0">
														<th scope="row" className="bg-muted/40 px-3 py-2 text-start font-medium text-muted-foreground">
															{row.label}
														</th>
														<td className="px-3 py-2 text-foreground tabular-nums">{row.value}</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								) : null}
								{undoHint !== undefined ? (
									<p data-slot="alert-dialog-undo-hint" className="text-xs text-muted-foreground">
										{undoHint}
									</p>
								) : null}
								{onPreferenceChange !== undefined ? (
									<label data-slot="alert-dialog-preference" className="flex items-center gap-2 text-start text-sm text-muted-foreground">
										<Checkbox checked={remembered} onCheckedChange={handlePreferenceChange} />
										{resolvedLabels.dontAskAgain}
									</label>
								) : null}
							</div>

							{/* Footer */}
							<AlertDialogFooter
								actionOrder={actionOrder}
								stackOrder={stackOrder}
								confirmShortcut={confirmShortcut}
								confirmLoading={confirmLoading}
								loadingLabel={resolvedLabels.loading}
								confirmLabel={resolvedLabels.confirm}
								cancelLabel={resolvedLabels.cancel}
								countdownLabel={countdownActive ? String(remaining) : undefined}
								thirdAction={thirdAction}
								onConfirm={onConfirm}
								onCancel={onCancel}
								severity={severity}
							/>
						</AlertDialogActionContext.Provider>
					</div>
				</div>
			</AlertDialogPrimitive.Popup>
		</AlertDialogPortal>
	);
});

// ── Header sub-parts ────────────────────────────────────────────────────────

export interface AlertDialogHeaderProps extends React.ComponentProps<"div"> {
	/** Center or start-aligned header (improvement 13). */
	readonly align?: AlertDialogAlign;
}

const AlertDialogHeader = React.forwardRef<HTMLDivElement, AlertDialogHeaderProps>(function AlertDialogHeader(
	{ className, align = "center", ...props },
	ref,
): React.JSX.Element {
	return (
		<div
			ref={ref}
			data-slot="alert-dialog-header"
			className={cn(
				"grid grid-rows-[auto_1fr] gap-1.5 has-data-[slot=alert-dialog-media]:grid-rows-[auto_auto_1fr] has-data-[slot=alert-dialog-media]:gap-x-6",
				align === "center" ? "place-items-center text-center" : "place-items-start text-start",
				className,
			)}
			{...props}
		/>
	);
});

export interface AlertDialogMediaProps extends React.ComponentProps<"div"> {
	/** Icon-tile tone (feature 5). */
	readonly severity?: AlertDialogSeverity;
}

const AlertDialogMedia = React.forwardRef<HTMLDivElement, AlertDialogMediaProps>(function AlertDialogMedia(
	{ className, severity = "info", ...props },
	ref,
): React.JSX.Element {
	return <div ref={ref} data-slot="alert-dialog-media" className={cn(alertDialogMediaVariants({ severity }), className)} {...props} />;
});

const AlertDialogTitle = React.forwardRef<HTMLHeadingElement, AlertDialogPrimitive.Title.Props>(function AlertDialogTitle({ className, ...props }, ref): React.JSX.Element {
	return (
		<AlertDialogPrimitive.Title
			ref={ref}
			data-slot="alert-dialog-title"
			className={cn("font-heading text-lg font-medium [&_svg]:inline [&_svg]:align-[calc(--spacing(0.75)*-1)] [&_svg:not([class*='size-'])]:size-5", className)}
			{...props}
		/>
	);
});

const AlertDialogDescription = React.forwardRef<HTMLParagraphElement, AlertDialogPrimitive.Description.Props>(function AlertDialogDescription(
	{ className, ...props },
	ref,
): React.JSX.Element {
	return (
		<AlertDialogPrimitive.Description
			ref={ref}
			data-slot="alert-dialog-description"
			className={cn("text-sm text-balance text-muted-foreground md:text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground", className)}
			{...props}
		/>
	);
});

// ── Footer ──────────────────────────────────────────────────────────────────

export interface AlertDialogFooterProps extends React.ComponentProps<"div"> {
	readonly actionOrder?: AlertDialogActionOrder | undefined;
	readonly stackOrder?: AlertDialogActionOrder | undefined;
	readonly confirmShortcut?: string | undefined;
	readonly confirmLoading?: boolean | undefined;
	/** Overrides the `alertDialog.loading` copy from `UiKitLabelsProvider`. */
	readonly loadingLabel?: string | undefined;
	/** Overrides the `alertDialog.confirm` copy from `UiKitLabelsProvider`. */
	readonly confirmLabel?: string | undefined;
	/** Overrides the `alertDialog.cancel` copy from `UiKitLabelsProvider`. */
	readonly cancelLabel?: string | undefined;
	readonly countdownLabel?: string | undefined;
	readonly thirdAction?: ReactNode | undefined;
	readonly onConfirm?: (() => void) | undefined;
	readonly onCancel?: (() => void) | undefined;
	readonly severity?: AlertDialogSeverity | undefined;
}

const AlertDialogFooter = React.forwardRef<HTMLDivElement, AlertDialogFooterProps>(function AlertDialogFooter(
	{
		className,
		actionOrder = "confirm-first",
		stackOrder = "confirm-first",
		confirmShortcut,
		confirmLoading = false,
		loadingLabel,
		confirmLabel,
		cancelLabel,
		countdownLabel,
		thirdAction,
		onConfirm,
		onCancel,
		severity = "info",
		...props
	},
	ref,
): React.JSX.Element {
	const labels = useUiKitLabels("alertDialog");
	const context = React.useContext(AlertDialogActionContext);
	const isConfirmDisabled = context.confirmDisabled;

	return (
		<div
			ref={ref}
			data-slot="alert-dialog-footer"
			className={cn(
				"flex items-center justify-end gap-2",
				// Mobile: primary-first stacking by default, `stackOrder` flips it.
				stackOrder === "confirm-first" ? "flex-col-reverse sm:flex-row" : "flex-col sm:flex-row",
				className,
			)}
			{...props}>
			{thirdAction}
			<AlertDialogCancel onCancel={onCancel}>{cancelLabel ?? labels.cancel}</AlertDialogCancel>
			<AlertDialogAction
				confirmLoading={confirmLoading}
				loadingLabel={loadingLabel}
				confirmLabel={confirmLabel}
				confirmShortcut={confirmShortcut}
				countdownLabel={countdownLabel}
				onConfirm={onConfirm}
				disabled={isConfirmDisabled}
				severity={severity}
				className={cn(actionOrder === "cancel-first" && "order-first sm:order-0")}
			/>
		</div>
	);
});

// ── Action (improvement 3: loading state; feature 2) ────────────────────────

export interface AlertDialogActionProps extends React.ComponentProps<typeof Button> {
	readonly confirmLoading?: boolean | undefined;
	/** Overrides the `alertDialog.loading` copy from `UiKitLabelsProvider`. */
	readonly loadingLabel?: string | undefined;
	/** Overrides the `alertDialog.confirm` copy from `UiKitLabelsProvider`. */
	readonly confirmLabel?: string | undefined;
	readonly confirmShortcut?: string | undefined;
	readonly countdownLabel?: string | undefined;
	readonly onConfirm?: (() => void) | undefined;
	readonly severity?: AlertDialogSeverity | undefined;
}

const AlertDialogAction = React.forwardRef<HTMLButtonElement, AlertDialogActionProps>(function AlertDialogAction(
	{ className, confirmLoading = false, loadingLabel, confirmLabel, confirmShortcut, countdownLabel, onConfirm, severity = "info", disabled, onClick, children, ...props },
	ref,
): React.JSX.Element {
	const labels = useUiKitLabels("alertDialog");
	const context = React.useContext(AlertDialogActionContext);
	// `confirmLoading` defaults to `false` (so `||` is fine), while `disabled` is
	// `boolean | undefined` from the caller — `??` is the safer merge there.
	const effectiveLoading = confirmLoading || context.confirmLoading;
	const effectiveDisabled = disabled ?? context.confirmDisabled;

	// Button is a base-ui wrapper — its event handlers receive `BaseUIEvent`
	// (native event + preventBaseUIHandler), not a plain React.MouseEvent.
	const handleClick = useCallback(
		(event: BaseUIEvent<React.MouseEvent<HTMLButtonElement>>): void => {
			onConfirm?.();
			onClick?.(event);
		},
		[onConfirm, onClick],
	);

	const buttonContent = effectiveLoading ? (
		<span className="inline-flex items-center gap-1.5">
			<Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
			{loadingLabel ?? labels.loading}
		</span>
	) : (
		<>
			{children ?? confirmLabel ?? labels.confirm}
			{countdownLabel !== undefined ? (
				<span data-slot="alert-dialog-countdown" className="text-current/70 tabular-nums">
					({countdownLabel})
				</span>
			) : null}
			{confirmShortcut !== undefined ? (
				<span className="hidden sm:inline-flex">
					<Kbd>{confirmShortcut}</Kbd>
				</span>
			) : null}
		</>
	);

	return (
		<Button
			ref={ref}
			data-slot="alert-dialog-action"
			variant={SEVERITY_CONFIRM_VARIANTS[severity]}
			onClick={handleClick}
			disabled={effectiveDisabled || effectiveLoading}
			className={className}
			{...props}>
			{buttonContent}
		</Button>
	);
});

// ── Cancel ──────────────────────────────────────────────────────────────────

// NOTE: must be a `type` alias — TS 6.0.3 removed `interface X extends A & B`
// (intersections in heritage clauses). Type aliases still allow intersections.
export type AlertDialogCancelProps = AlertDialogPrimitive.Close.Props &
	React.ComponentProps<typeof Button> & {
		readonly onCancel?: (() => void) | undefined;
	};

const AlertDialogCancel = React.forwardRef<HTMLButtonElement, AlertDialogCancelProps>(function AlertDialogCancel(
	{ className, variant = "outline", size = "default", onCancel, onClick, children, ...props },
	ref,
): React.JSX.Element {
	const handleClick = useCallback(
		(event: BaseUIEvent<React.MouseEvent<HTMLButtonElement>>): void => {
			onCancel?.();
			onClick?.(event);
		},
		[onCancel, onClick],
	);
	const renderButton = useMemo<React.JSX.Element>(() => <Button variant={variant} size={size} />, [variant, size]);

	return (
		<AlertDialogPrimitive.Close ref={ref} data-slot="alert-dialog-cancel" onClick={handleClick} className={className} render={renderButton} {...props}>
			{children}
		</AlertDialogPrimitive.Close>
	);
});

export {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogMedia,
	AlertDialogOverlay,
	AlertDialogPortal,
	AlertDialogTitle,
	AlertDialogTrigger,
	alertDialogActionOrderSchema,
	alertDialogContentVariants,
	alertDialogMediaVariants,
	alertDialogAlignSchema,
	alertDialogSeveritySchema,
	alertDialogSizeSchema,
	alertDialogWidthSchema,
	type AlertDialogActionOrder,
	type AlertDialogAlign,
	type AlertDialogSeverity,
	type AlertDialogSize,
	type AlertDialogWidth,
};
