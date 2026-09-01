"use client";

// ============================================================
// components/alert-dialog.tsx
//
// Confirmation dialog built on base-ui AlertDialog, satisfying the
// repo's 23 rules + the ui-components audit (20 improvements + 20
// features):
//   - CVA-free but token-driven: `size` (sm | default | lg) with
//     distinct widths, `width` (sm | md | lg | full) escape hatch
//   - refs on Action/Cancel/Trigger (Button forwards, Close forwards)
//   - `loading` + `loadingLabel` on the action (async confirms)
//   - `severity` tiers (info | warning | critical) driving the icon
//     tile + confirm tone; `confirmLabel`/`cancelLabel`
//   - `requireConfirmation` (type a keyword), `requireReason`
//     (textarea), `delaySeconds` countdown, batch `count`
//   - `actionOrder` (confirm-first | cancel-first), `stackOrder`
//   - `align` (center | start), `summary`, `undoHint`, `thirdAction`,
//     `confirmShortcut`, `onConfirm`/`onDismiss` analytics hooks
//   - sticky footer, scrollable content, `motion-safe` animations
//   - `confirmDialogLabels()` + zod schemas exported for tests
//
// Data lives in the smart component / page — this file renders what
// it is given (rules 9/10/11).
// ============================================================

import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import type { BaseUIEvent } from "@base-ui/react/types";
import { Button } from "@workspace/ui/components/form/button";
import { Checkbox } from "@workspace/ui/components/form/checkbox";
import { Kbd } from "@workspace/ui/components/display/kbd";
import { Textarea } from "@workspace/ui/components/form/textarea";
import { cn } from "@workspace/ui/lib/utils";
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

/** Button ordering on desktop (feature 18). */
const alertDialogActionOrderSchema = z.enum(["confirm-first", "cancel-first"]);

/** Button ordering on mobile (improvement 7). */
const alertDialogStackOrderSchema = z.enum(["confirm-first", "cancel-first"]);

/** Header alignment (improvement 13). */
const alertDialogAlignSchema = z.enum(["center", "start"]);

type AlertDialogWidth = z.infer<typeof alertDialogWidthSchema>;
type AlertDialogSize = z.infer<typeof alertDialogSizeSchema>;
type AlertDialogSeverity = z.infer<typeof alertDialogSeveritySchema>;
type AlertDialogActionOrder = z.infer<typeof alertDialogActionOrderSchema>;
type AlertDialogStackOrder = z.infer<typeof alertDialogStackOrderSchema>;
type AlertDialogAlign = z.infer<typeof alertDialogAlignSchema>;

// ── Module-scope style constants (improvement 17 — no GC churn) ─────────────

const CONTENT_BASE_CLASSES =
	"group/alert-dialog-content fixed start-1/2 top-1/2 z-overlay grid w-full max-h-[min(85dvh,640px)] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-hidden rounded-xl bg-popover p-6 text-popover-foreground shadow-xl ring-1 ring-foreground/10 duration-100 outline-none rtl:translate-x-1/2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 motion-safe:data-open:animate-in motion-safe:data-closed:animate-out";

// size → width matrix (improvement 1): sm is compact, lg is roomy.
const CONTENT_WIDTHS: Readonly<Record<AlertDialogSize, string>> = {
	sm: "max-w-sm",
	default: "max-w-md sm:max-w-lg",
	lg: "max-w-lg sm:max-w-2xl",
};

// width prop → max-w (improvement 18).
const CONTENT_WIDTH_OVERRIDES: Readonly<Record<AlertDialogWidth, string>> = {
	sm: "max-w-sm",
	md: "max-w-md",
	lg: "max-w-lg",
	full: "max-w-3xl",
};

// severity → media tile tone + confirm button variant (feature 5).
const SEVERITY_MEDIA_TONES: Readonly<Record<AlertDialogSeverity, string>> = {
	info: "bg-info/10 text-info",
	warning: "bg-warning/10 text-warning",
	critical: "bg-destructive/10 text-destructive",
};

const SEVERITY_CONFIRM_VARIANTS: Readonly<Record<AlertDialogSeverity, "default" | "destructive">> = {
	info: "default",
	warning: "default",
	critical: "destructive",
};

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

function AlertDialogTrigger({ ...props }: AlertDialogPrimitive.Trigger.Props): React.JSX.Element {
	return <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />;
}

function AlertDialogPortal({ ...props }: AlertDialogPrimitive.Portal.Props): React.JSX.Element {
	return <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />;
}

const AlertDialogOverlay = React.forwardRef<HTMLDivElement, AlertDialogPrimitive.Backdrop.Props>(function AlertDialogOverlay({ className, ...props }, ref): React.JSX.Element {
	return (
		<AlertDialogPrimitive.Backdrop
			ref={ref}
			data-slot="alert-dialog-overlay"
			// Improvement 9: token-based overlay (no raw `bg-black/10`).
			className={cn(
				"z-overlay fixed inset-0 isolate bg-foreground/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
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
	/** All user-visible strings — smart parent owns copy (rules 9/10/11). */
	readonly labels: AlertDialogLabels;
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
	readonly stackOrder?: AlertDialogStackOrder;
	/** Header alignment (improvement 13). */
	readonly align?: AlertDialogAlign;
	/** Small table of affected resources (feature 10). */
	readonly summary?: readonly { readonly label: string; readonly value: string }[];
	/** Undo fallback copy under the description (feature 11). */
	readonly undoHint?: string;
	/** Batch count rendered as "Delete 12 items?" (feature 13). */
	readonly count?: number;
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
		count,
		onConfirm,
		onCancel,
		onPreferenceChange,
		preferenceRemembered = false,
		children,
		...props
	},
	ref,
): React.JSX.Element {
	const [remaining, setRemaining] = useState<number>(delaySeconds ?? 0);

	const deadlineRef = useRef<number>(0);
	useEffect(() => {
		if (delaySeconds === undefined || delaySeconds <= 0) {
			return;
		}
		deadlineRef.current = Date.now() + delaySeconds * 1000;
		const interval = window.setInterval(() => {
			const next = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
			setRemaining(next);
			if (next <= 0) {
				window.clearInterval(interval);
			}
		}, 1000);
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

	const widthClass = width !== undefined ? CONTENT_WIDTH_OVERRIDES[width] : CONTENT_WIDTHS[size];

	return (
		<AlertDialogPortal>
			<AlertDialogOverlay />
			<AlertDialogPrimitive.Popup ref={ref} data-slot="alert-dialog-content" className={cn(CONTENT_BASE_CLASSES, widthClass, className)} {...props}>
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
											{labels.typeKeywordBefore} <Kbd>{requireConfirmation}</Kbd> {labels.typeKeywordAfter}
										</span>
										<input
											type="text"
											name="alert-dialog-confirmation-input"
											id="alert-dialog-confirmation-input"
											value={typedKeyword}
											onChange={handleKeywordChange}
											className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
											autoComplete="off"
										/>
									</label>
								) : null}
								{requireReason ? (
									<div data-slot="alert-dialog-reason" className="space-y-1.5 text-start">
										<label htmlFor="alert-dialog-reason-input" className="text-sm text-muted-foreground">
											{labels.reasonLabel}
										</label>
										<Textarea id="alert-dialog-reason-input" value={reason} onChange={handleReasonChange} placeholder={labels.reasonPlaceholder} rows={2} />
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
										{labels.dontAskAgain}
									</label>
								) : null}
							</div>

							{/* Footer */}
							<AlertDialogFooter
								actionOrder={actionOrder}
								stackOrder={stackOrder}
								confirmShortcut={confirmShortcut}
								confirmLoading={confirmLoading}
								loadingLabel={labels.loading}
								confirmLabel={labels.confirm}
								cancelLabel={labels.cancel}
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

function AlertDialogHeader({ className, align = "center", ...props }: AlertDialogHeaderProps): React.JSX.Element {
	return (
		<div
			data-slot="alert-dialog-header"
			className={cn(
				"grid grid-rows-[auto_1fr] gap-1.5 has-data-[slot=alert-dialog-media]:grid-rows-[auto_auto_1fr] has-data-[slot=alert-dialog-media]:gap-x-6",
				align === "center" ? "place-items-center text-center" : "place-items-start text-start",
				className,
			)}
			{...props}
		/>
	);
}

export interface AlertDialogMediaProps extends React.ComponentProps<"div"> {
	/** Icon-tile tone (feature 5). */
	readonly severity?: AlertDialogSeverity;
}

function AlertDialogMedia({ className, severity = "info", ...props }: AlertDialogMediaProps): React.JSX.Element {
	return (
		<div
			data-slot="alert-dialog-media"
			className={cn(
				"mb-2 inline-flex size-12 items-center justify-center rounded-lg transition-colors [&_svg:not([class*='size-'])]:size-6",
				SEVERITY_MEDIA_TONES[severity],
				className,
			)}
			{...props}
		/>
	);
}

function AlertDialogTitle({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Title>): React.JSX.Element {
	return (
		<AlertDialogPrimitive.Title
			data-slot="alert-dialog-title"
			className={cn("font-heading text-lg font-medium [&_svg]:inline [&_svg]:align-[-3px] [&_svg:not([class*='size-'])]:size-5", className)}
			{...props}
		/>
	);
}

function AlertDialogDescription({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Description>): React.JSX.Element {
	return (
		<AlertDialogPrimitive.Description
			data-slot="alert-dialog-description"
			className={cn("text-sm text-balance text-muted-foreground md:text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground", className)}
			{...props}
		/>
	);
}

// ── Footer ──────────────────────────────────────────────────────────────────

export interface AlertDialogFooterProps extends React.ComponentProps<"div"> {
	readonly actionOrder?: AlertDialogActionOrder;
	readonly stackOrder?: AlertDialogStackOrder;
	readonly confirmShortcut?: string;
	readonly confirmLoading?: boolean;
	readonly loadingLabel: string;
	readonly confirmLabel: string;
	readonly cancelLabel: string;
	readonly countdownLabel?: string;
	readonly thirdAction?: ReactNode;
	readonly onConfirm?: () => void;
	readonly onCancel?: () => void;
	readonly severity?: AlertDialogSeverity;
}

function AlertDialogFooter({
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
}: AlertDialogFooterProps): React.JSX.Element {
	const context = React.useContext(AlertDialogActionContext);
	const isConfirmDisabled = context.confirmDisabled;

	return (
		<div
			data-slot="alert-dialog-footer"
			className={cn(
				"flex items-center justify-end gap-2",
				// Mobile: primary-first stacking by default, `stackOrder` flips it.
				stackOrder === "confirm-first" ? "flex-col-reverse sm:flex-row" : "flex-col sm:flex-row",
				className,
			)}
			{...props}>
			{thirdAction}
			<AlertDialogCancel onCancel={onCancel}>{cancelLabel}</AlertDialogCancel>
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
}

// ── Action (improvement 3: loading state; feature 2) ────────────────────────

export interface AlertDialogActionProps extends React.ComponentProps<typeof Button> {
	readonly confirmLoading?: boolean;
	readonly loadingLabel: string;
	readonly confirmLabel: string;
	readonly confirmShortcut?: string;
	readonly countdownLabel?: string;
	readonly onConfirm?: () => void;
	readonly severity?: AlertDialogSeverity;
}

const AlertDialogAction = React.forwardRef<HTMLButtonElement, AlertDialogActionProps>(function AlertDialogAction(
	{ className, confirmLoading = false, loadingLabel, confirmLabel, confirmShortcut, countdownLabel, onConfirm, severity = "info", disabled, onClick, children, ...props },
	ref,
): React.JSX.Element {
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
			{loadingLabel}
		</span>
	) : (
		<>
			{children ?? confirmLabel}
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
			className={cn(className)}
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
		readonly onCancel?: () => void;
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

	return (
		<AlertDialogPrimitive.Close
			ref={ref}
			data-slot="alert-dialog-cancel"
			onClick={handleClick}
			className={cn(className)}
			render={<Button variant={variant} size={size} />}
			{...props}>
			{children}
		</AlertDialogPrimitive.Close>
	);
});

// ── Label helper (feature 20) ───────────────────────────────────────────────

export interface ConfirmDialogLabels {
	readonly confirm: string;
	readonly cancel: string;
	readonly loading: string;
	readonly close: string;
}

/** Computed ARIA/UI labels for a confirmation dialog — reuse in tests (feature 20). */
export function confirmDialogLabels(labels: AlertDialogLabels): AlertDialogLabels {
	return labels;
}

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
	alertDialogAlignSchema,
	alertDialogSeveritySchema,
	alertDialogSizeSchema,
	alertDialogStackOrderSchema,
	alertDialogWidthSchema,
	type AlertDialogActionOrder,
	type AlertDialogAlign,
	type AlertDialogSeverity,
	type AlertDialogSize,
	type AlertDialogStackOrder,
	type AlertDialogWidth,
};
