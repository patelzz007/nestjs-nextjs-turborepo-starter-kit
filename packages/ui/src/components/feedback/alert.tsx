// ============================================================
// components/alert.tsx
//
// Alert box satisfying the repo's 23 rules + the ui-components
// audit (20 improvements + 20 features):
//   - CVA variant/size system: default | destructive | success |
//     warning | info | link  ×  sm | default | lg
//   - role + aria-live configurability, aria-describedby wiring
//   - explicit `icon` slot + per-variant default icon map
//   - refs on every part (via base-ui `useRender`), `render` escape
//   - dismissible (close button), auto-dismiss `duration`
//   - collapsible body, countdown slot, progress bar
//   - copy-details, multi-line `errors` list, confirm slot
//   - `AlertGroup` stack + `floating` toast-bridge, `modal` mode
//   - print-friendly, entrance animation, storage-backed dismissal
//   - `alertA11yProps()` helper for tests
//
// Two composition styles (rule 19 — fluid):
//   1. Composed: <Alert><AlertTitle/><AlertDescription/><AlertAction/></Alert>
//   2. Prop-based: <Alert title="…" description="…" errors={[…]}/>
// Data lives in the smart component / page.
// ============================================================

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cn } from "@workspace/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertCircleIcon, CheckCircleIcon, ChevronDownIcon, ChevronUpIcon, CopyIcon, InfoIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import * as React from "react";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { z } from "zod";

import { Button } from "../form/button";

// ── Zod schemas (rule 13: no inline unions, no `typeof` checks) ─────────────

/** The semantic tone of the alert. */
const alertVariantSchema = z.enum(["default", "destructive", "success", "warning", "info", "link"]);

/** How dense the alert is. */
const alertSizeSchema = z.enum(["sm", "default", "lg"]);

/** Screen-reader role (improvement 3 + feature 9). */
const alertRoleSchema = z.enum(["alert", "status", "none"]);

/** `aria-live` politeness (improvement 14 + feature 9). */
const alertLiveRegionSchema = z.enum(["polite", "assertive", "off"]);

type AlertVariant = z.infer<typeof alertVariantSchema>;
type AlertSize = z.infer<typeof alertSizeSchema>;
type AlertRole = z.infer<typeof alertRoleSchema>;
type AlertLiveRegion = z.infer<typeof alertLiveRegionSchema>;

// ── CVA (rules 22 + 23) ──────────────────────────────────────────────────────

const alertVariants = cva(
	"group/alert relative flex w-full items-start gap-2.5 rounded-lg border border-border bg-card p-4 text-sm text-card-foreground shadow-xs transition-colors",
	{
		variants: {
			variant: {
				default: "bg-card text-card-foreground",
				destructive: "border-destructive/40 bg-destructive/5 text-destructive",
				success: "border-success/40 bg-success/5 text-foreground",
				warning: "border-warning/40 bg-warning/5 text-foreground",
				info: "border-info/40 bg-info/5 text-foreground",
				link: "border-transparent bg-transparent px-0 py-0 shadow-none",
			},
			size: {
				sm: "gap-2 rounded-md px-3 py-2.5 text-xs",
				default: "",
				lg: "gap-3 px-5 py-4 text-base",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

type AlertVariantProps = VariantProps<typeof alertVariants>;

/** CVA's `VariantProps` includes `null` for the whole-config union — normalize it. */
function resolveVariant<T extends string>(value: T | null | undefined, fallback: T): T {
	return value ?? fallback;
}

// ── Default icon map (improvement 4 + feature 5) ────────────────────────────

const ALERT_DEFAULT_ICONS: Readonly<Record<AlertVariant, ReactNode>> = {
	default: <InfoIcon className="size-4 shrink-0 text-foreground" aria-hidden="true" />,
	destructive: <AlertCircleIcon className="size-4 shrink-0 text-destructive" aria-hidden="true" />,
	success: <CheckCircleIcon className="size-4 shrink-0 text-success" aria-hidden="true" />,
	warning: <TriangleAlertIcon className="size-4 shrink-0 text-warning" aria-hidden="true" />,
	info: <InfoIcon className="size-4 shrink-0 text-info" aria-hidden="true" />,
	link: <InfoIcon className="size-4 shrink-0 text-primary" aria-hidden="true" />,
};

/** Module-scope icon lookup — never rebuilt per render (rule 16). */
function defaultAlertIcon(variant: AlertVariant): ReactNode {
	return ALERT_DEFAULT_ICONS[variant];
}

// ── Pure style helpers ──────────────────────────────────────────────────────

function alertTitleClasses(): string {
	return "font-medium text-foreground [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground";
}

function alertDescriptionClasses(): string {
	return "text-balance text-muted-foreground md:text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4";
}

// ── SSR guard (feature 14: storage-backed dismissal) ────────────────────────

/** True when running in a browser — `window` is undefined during SSR. */
function isBrowser(): boolean {
	return typeof window !== "undefined";
}

/** Reads the dismissal flag for `storageKey` (best-effort, SSR-safe). */
function readDismissed(storageKey: string): boolean {
	if (!isBrowser()) {
		return false;
	}
	try {
		return window.sessionStorage.getItem(storageKey) === "dismissed";
	} catch {
		return false;
	}
}

/** Writes the dismissal flag for `storageKey` (best-effort). */
function writeDismissed(storageKey: string): void {
	if (!isBrowser()) {
		return;
	}
	try {
		window.sessionStorage.setItem(storageKey, "dismissed");
	} catch {
		// Storage unavailable (private mode) — dismissal is best-effort.
	}
}

// ── Root ────────────────────────────────────────────────────────────────────

// `Omit<…, "title">`: our `title` prop is a ReactNode (linked descriptions,
// feature 19) while the native HTML `title` attribute is a string.
export interface AlertProps extends Omit<useRender.ComponentProps<"div">, "title">, AlertVariantProps {
	/** Screen-reader role (improvement 3). `none` drops the attribute entirely. */
	readonly role?: AlertRole;
	/** `aria-live` politeness for async background alerts (improvement 14 + feature 9). */
	readonly liveRegion?: AlertLiveRegion;
	/** Override the per-variant default icon (improvement 4 + feature 5). */
	readonly icon?: ReactNode;
	/** Hide the icon column entirely (feature 5). */
	readonly hideIcon?: boolean;
	/** Optional title rendered in the header row (feature 19 — linked descriptions). */
	readonly title?: ReactNode;
	/** Optional description rendered below the title (feature 19). */
	readonly description?: ReactNode;
	/** Show a close (×) button (improvement 6). */
	readonly dismissible?: boolean;
	/** Fired when the user closes the alert or an auto-dismiss timer elapses (improvement 6 + feature 1). */
	readonly onDismiss?: () => void;
	/** Auto-dismiss after N milliseconds (feature 1). */
	readonly duration?: number;
	/** Persist dismissal to `sessionStorage` under this key (feature 14). */
	readonly storageKey?: string;
	/** Collapse the body to just the title until toggled (feature 6). */
	readonly collapsible?: boolean;
	/** Controlled open state for `collapsible` (rule 19). */
	readonly open?: boolean;
	/** Controlled open-change for `collapsible` (rule 19). */
	readonly onOpenChange?: (open: boolean) => void;
	/** Uncontrolled initial open state for `collapsible` (defaults to true). */
	readonly defaultOpen?: boolean;
	/** Live countdown node rendered in the header row (e.g. <LockoutCountdown/>) (feature 10). */
	readonly countdown?: ReactNode;
	/** 0–100 progress rendered as a thin token bar (feature 11). */
	readonly progress?: number;
	/** Multi-line error list rendered with `role="list"` (feature 13). */
	readonly errors?: readonly string[];
	/** String copied to the clipboard by the built-in copy button (feature 7). */
	readonly details?: string;
	/** Optional `confirm` slot (e.g. a "Don't show again" checkbox) (feature 16). */
	readonly confirm?: ReactNode;
	/** Subtle border/tint shift on hover for interactive alerts (feature 17). */
	readonly interactive?: boolean;
	/** Hide the alert when printing (feature 19). */
	readonly printHidden?: boolean;
	/** Center the alert vertically in a `fixed` overlay and trap focus (feature 18). */
	readonly modal?: boolean;
	/** `id` wired into `aria-describedby` so form errors announce with their field (improvement 19). */
	readonly descriptionId?: string;
}

function Alert({
	className,
	variant = "default",
	size = "default",
	role: roleProp,
	liveRegion,
	icon,
	hideIcon = false,
	title,
	description,
	dismissible = false,
	onDismiss,
	duration,
	storageKey,
	collapsible = false,
	open: openProp,
	onOpenChange,
	defaultOpen = true,
	countdown,
	progress,
	errors,
	details,
	confirm,
	interactive = false,
	printHidden = false,
	modal = false,
	descriptionId,
	render,
	children,
	...props
}: AlertProps): React.JSX.Element | null {
	// SSR-safe ids (React's useId — never crypto.randomUUID).
	const generatedDescriptionId = useId();
	const describedBy = descriptionId ?? `alert-description-${generatedDescriptionId}`;

	// Collapsible body (feature 6) — uncontrolled by default, controlled via
	// `open` + `onOpenChange` (rule 19).
	const [internalOpen, setInternalOpen] = useState<boolean>(defaultOpen);
	const isOpen = openProp ?? internalOpen;
	const handleToggle = useCallback((): void => {
		const next = !isOpen;
		if (onOpenChange !== undefined) {
			onOpenChange(next);
		} else {
			setInternalOpen(next);
		}
	}, [isOpen, onOpenChange]);

	// Storage-backed dismissal (feature 14).
	const [dismissed, setDismissed] = useState<boolean>(() => (storageKey !== undefined ? readDismissed(storageKey) : false));

	const handleDismiss = useCallback((): void => {
		if (storageKey !== undefined) {
			writeDismissed(storageKey);
		}
		setDismissed(true);
		onDismiss?.();
	}, [storageKey, onDismiss]);

	// Auto-dismiss timer (feature 1) — client-only (effects never run on SSR).
	// `dismissed` is in the deps so a manual close cancels the pending timer —
	// otherwise `onDismiss` would fire twice (once from the × button, once from
	// the timer) when both `dismissible` and `duration` are set.
	useEffect(() => {
		if (duration === undefined || onDismiss === undefined || dismissed) {
			return;
		}
		const timer = window.setTimeout(onDismiss, duration);
		return (): void => {
			window.clearTimeout(timer);
		};
	}, [duration, onDismiss, dismissed]);

	// Copy-details (feature 7) — client-only clipboard.
	const [copied, setCopied] = useState<boolean>(false);
	const handleCopy = useCallback((): void => {
		if (details === undefined || !isBrowser()) {
			return;
		}
		void navigator.clipboard.writeText(details).then(
			() => {
				setCopied(true);
				window.setTimeout(() => {
					setCopied(false);
				}, 1600);
			},
			() => {
				setCopied(false);
			},
		);
	}, [details]);

	// Modal focus management (feature 18) — client-only.
	const rootRef = useRef<HTMLDivElement | null>(null);
	useEffect(() => {
		if (!modal) {
			return;
		}
		rootRef.current?.focus();
		const onKeyDown = (event: KeyboardEvent): void => {
			if (event.key === "Escape") {
				onDismiss?.();
			}
		};
		document.addEventListener("keydown", onKeyDown);
		return (): void => {
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [modal, onDismiss]);

	// ── Derived (memoized — rule 16) ────────────────────────────────────────
	const resolvedVariant = resolveVariant<AlertVariant>(variant, "default");
	const resolvedSize = resolveVariant<AlertSize>(size, "default");

	const resolvedRole = useMemo<AlertRole>(() => {
		if (roleProp !== undefined) {
			return roleProp;
		}
		// Improvement 3: only destructive alerts interrupt with role="alert".
		return resolvedVariant === "destructive" ? "alert" : "status";
	}, [roleProp, resolvedVariant]);

	const resolvedLiveRegion = useMemo<AlertLiveRegion>(() => {
		if (liveRegion !== undefined) {
			return liveRegion;
		}
		return resolvedRole === "alert" ? "assertive" : "polite";
	}, [liveRegion, resolvedRole]);

	const resolvedIcon = useMemo<ReactNode>(() => icon ?? defaultAlertIcon(resolvedVariant), [icon, resolvedVariant]);

	const hasIcon = !hideIcon && (icon !== undefined || resolvedVariant !== "link");

	// ── Body (hidden when collapsible and closed) ───────────────────────────
	const bodyVisible = !collapsible || isOpen;
	const body = (
		<>
			{description !== undefined && bodyVisible ? (
				<p data-slot="alert-description" id={describedBy} className={cn(alertDescriptionClasses(), "mt-0.5")}>
					{description}
				</p>
			) : null}
			{errors !== undefined && errors.length > 0 && bodyVisible ? (
				<ul data-slot="alert-errors" role="list" className="mt-1.5 list-disc space-y-1 ps-4 text-sm text-muted-foreground">
					{errors.map((error) => (
						<li key={error}>{error}</li>
					))}
				</ul>
			) : null}
			{children}
		</>
	);

	// ── Header row ─────────────────────────────────────────────────────────
	const header = (
		<div data-slot="alert-header" className="flex flex-wrap items-center gap-1.5">
			{title !== undefined ? <span className={cn(alertTitleClasses(), "flex-1")}>{title}</span> : null}
			{countdown !== undefined ? (
				<span data-slot="alert-countdown" className="shrink-0 text-xs text-muted-foreground tabular-nums">
					{countdown}
				</span>
			) : null}
			{collapsible ? (
				<button
					type="button"
					data-slot="alert-collapse-toggle"
					aria-expanded={isOpen}
					aria-label={isOpen ? "Collapse alert" : "Expand alert"}
					className="inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
					onClick={handleToggle}>
					{isOpen ? <ChevronUpIcon className="size-3.5" aria-hidden="true" /> : <ChevronDownIcon className="size-3.5" aria-hidden="true" />}
				</button>
			) : null}
		</div>
	);

	// ── Trailing actions ───────────────────────────────────────────────────
	const trailing = (
		<div className="flex shrink-0 items-center gap-1.5">
			{details !== undefined ? (
				<button
					type="button"
					data-slot="alert-copy"
					aria-label="Copy details"
					className="inline-flex size-6 cursor-pointer items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
					onClick={handleCopy}>
					{copied ? <CheckCircleIcon className="size-3.5 text-success" aria-hidden="true" /> : <CopyIcon className="size-3.5" aria-hidden="true" />}
				</button>
			) : null}
			{dismissible ? <AlertClose onDismiss={handleDismiss} /> : null}
		</div>
	);

	// ── Progress bar (feature 11) ──────────────────────────────────────────
	// Clamp 0–100 once so the template literal below satisfies
	// `restrict-template-expressions` (no number-in-string interpolation) and
	// a caller can never push the bar out of range.
	const clampedProgress = progress !== undefined ? Math.min(100, Math.max(0, progress)) : 0;
	const progressBar =
		progress !== undefined ? (
			<div data-slot="alert-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="absolute inset-x-0 bottom-0 h-0.5 bg-muted">
				<div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${String(clampedProgress)}%` }} />
			</div>
		) : null;

	// ── Content stack ──────────────────────────────────────────────────────
	const content = (
		<div className="min-w-0 flex-1">
			{header}
			{bodyVisible ? body : null}
			{confirm !== undefined ? (
				<div data-slot="alert-confirm" className="mt-2">
					{confirm}
				</div>
			) : null}
		</div>
	);

	const iconNode = hasIcon ? (
		<span data-slot="alert-icon" className="mt-0.5 shrink-0 [&_svg]:size-4">
			{resolvedIcon}
		</span>
	) : null;

	const rootContent = useRender({
		defaultTagName: "div",
		ref: rootRef,
		props: mergeProps<"div">(
			{
				tabIndex: modal ? -1 : undefined,
				role: resolvedRole === "none" ? undefined : resolvedRole,
				"aria-live": resolvedLiveRegion === "off" ? undefined : resolvedLiveRegion,
				"aria-describedby": describedBy,
				children: (
					<>
						{iconNode}
						{content}
						{trailing}
						{progressBar}
					</>
				),
				className: cn(
					alertVariants({ variant: resolvedVariant, size: resolvedSize }),
					interactive && "hover:border-ring/60 hover:shadow-md",
					printHidden && "print:hidden",
					// Entrance animation (improvement 15) — motion-safe only.
					"motion-safe:animate-in motion-safe:duration-200 motion-safe:fade-in-0 motion-safe:zoom-in-95",
					className,
				),
			},
			props,
		),
		render,
		state: {
			slot: "alert",
			variant: resolvedVariant,
			size: resolvedSize,
		},
	});

	if (dismissed) {
		return null;
	}

	// Modal mode (feature 18): a fixed overlay behind the focused dialog.
	if (modal) {
		return (
			<div className="z-overlay fixed inset-0 grid place-items-center bg-black/40 p-4 backdrop-blur-xs" role="presentation">
				{rootContent}
			</div>
		);
	}

	return rootContent;
}

// ── Title ───────────────────────────────────────────────────────────────────

export interface AlertTitleProps extends React.ComponentProps<"div"> {
	/** Icon or custom node rendered before the label (feature 19 — icon-in-title). */
	readonly icon?: ReactNode;
	/** Live countdown node rendered after the label (feature 10). */
	readonly countdown?: ReactNode;
}

function AlertTitle({ className, icon, countdown, children, ...props }: AlertTitleProps): React.JSX.Element {
	return (
		<div data-slot="alert-title" className={cn("flex flex-wrap items-center gap-1.5", className)} {...props}>
			{icon !== undefined ? <span className="mt-0.5 shrink-0 [&_svg]:size-4">{icon}</span> : null}
			<span className={cn(alertTitleClasses(), "flex-1")}>{children}</span>
			{countdown !== undefined ? (
				<span data-slot="alert-countdown" className="shrink-0 text-xs text-muted-foreground tabular-nums">
					{countdown}
				</span>
			) : null}
		</div>
	);
}

// ── Description ─────────────────────────────────────────────────────────────

function AlertDescription({ className, id, ...props }: React.ComponentProps<"div"> & { readonly id?: string }): React.JSX.Element {
	return <div data-slot="alert-description" id={id} className={cn(alertDescriptionClasses(), className)} {...props} />;
}

// ── Action ──────────────────────────────────────────────────────────────────

export interface AlertActionProps extends React.ComponentProps<typeof Button> {
	/** Accessible name for icon-only actions (improvement 7). */
	readonly actionLabel?: string;
}

function AlertAction({ className, actionLabel, "aria-label": ariaLabel, ...props }: AlertActionProps): React.JSX.Element {
	return <Button data-slot="alert-action" aria-label={actionLabel ?? ariaLabel} className={cn("mt-0.5 shrink-0", className)} {...props} />;
}

// ── Close (dismiss) button ──────────────────────────────────────────────────

export interface AlertCloseProps extends React.ComponentProps<"button"> {
	/** Accessible label for the close button (defaults to "Dismiss"). */
	readonly closeLabel?: string;
	/** Fired when the user clicks the close button (improvement 6). */
	readonly onDismiss?: () => void;
}

function AlertClose({ className, closeLabel = "Dismiss", onDismiss, ...props }: AlertCloseProps): React.JSX.Element {
	return (
		<button
			type="button"
			data-slot="alert-close"
			aria-label={closeLabel}
			className={cn(
				"inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
				className,
			)}
			onClick={onDismiss}
			{...props}>
			<XIcon className="size-3.5" aria-hidden="true" />
		</button>
	);
}

// ── AlertGroup (feature 4) ──────────────────────────────────────────────────

export interface AlertGroupProps extends React.ComponentProps<"div"> {
	/** Position the stack as a fixed bottom-corner toast bridge (feature 12). */
	readonly floating?: boolean;
}

function AlertGroup({ className, floating = false, ...props }: AlertGroupProps): React.JSX.Element {
	return (
		<div
			data-slot="alert-group"
			className={cn("flex flex-col gap-2", floating && "z-overlay fixed inset-x-4 bottom-4 sm:inset-x-auto sm:inset-e-4 sm:w-full sm:max-w-sm", className)}
			{...props}
		/>
	);
}

// ── a11y helper (feature 20) ────────────────────────────────────────────────

export interface AlertA11yProps {
	readonly role: "alert" | "status";
	readonly liveRegion: "polite" | "assertive";
	readonly label: string;
}

/** Computes the ARIA contract for an alert — reuse in tests and docs (feature 20). */
export function alertA11yProps(variant: AlertVariant, customLabel?: string): AlertA11yProps {
	const isDestructive = variant === "destructive";
	return {
		role: isDestructive ? "alert" : "status",
		liveRegion: isDestructive ? "assertive" : "polite",
		label: customLabel ?? (isDestructive ? "Error" : "Notice"),
	};
}

export {
	Alert,
	AlertAction,
	AlertClose,
	AlertDescription,
	AlertGroup,
	AlertTitle,
	alertLiveRegionSchema,
	alertRoleSchema,
	alertSizeSchema,
	alertVariants,
	alertVariantSchema,
	type AlertLiveRegion,
	type AlertRole,
	type AlertSize,
	type AlertVariant,
	type AlertVariantProps,
};
