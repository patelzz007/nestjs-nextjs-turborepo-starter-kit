"use client";

import { Eye, EyeOff } from "lucide-react";
import * as React from "react";

import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@workspace/ui/components/input-group";
import type { InputProps } from "@workspace/ui/components/input";
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";

/** Copy for the show/hide toggle and the caps-lock hint — the `passwordInput` family of `UiKitLabels`. */
export interface PasswordInputLabels {
	/** Accessible name of the toggle while the password is masked. */
	readonly show: string;
	/** Accessible name of the toggle while the password is visible. */
	readonly hide: string;
	/** The hint shown while Caps Lock is on. */
	readonly capsLockOn: string;
}

export type PasswordInputProps = InputProps & {
	/** Controlled visibility. Pair with `onVisibleChange`; omit both for the uncontrolled toggle. */
	readonly visible?: boolean;
	/** Initial visibility when uncontrolled. */
	readonly defaultVisible?: boolean;
	/** Fired with the next visibility whenever the toggle is pressed. */
	readonly onVisibleChange?: (visible: boolean) => void;
	/** Per-usage overrides of the `passwordInput` copy from `UiKitLabelsProvider`. */
	readonly labels?: UiKitLabelsOverride<"passwordInput"> | undefined;
};

/**
 * Password input with two UX affordances:
 * - **Show/hide toggle** — an inline eye button flips the field between
 *   `type="password"` and `type="text"`. Controlled via `visible` /
 *   `onVisibleChange`, or uncontrolled (`defaultVisible`).
 * - **Caps-lock warning** — when the field has focus and Caps Lock is on, a
 *   small warning hint appears below (the classic "your password will be typed
 *   in capitals" nudge).
 *
 * Pure presentational: value/onChange flow in via props, exactly like the base
 * `Input`. Both apps use it on their login forms.
 *
 * Ref forwarding (rule 20): the ref lands on the inner `<input>` so RHF
 * `register()` and focus management work.
 *
 * Event contract (rule 21): `onChange`/`onBlur`/`onFocus` pass straight
 * through to the input. `onKeyDown`/`onKeyUp` are *composed* with the internal
 * caps-lock detector (never clobbered), and `onBlur` also clears the stale
 * caps-lock hint.
 */
const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
	{ className, onChange, onBlur, onFocus, onKeyDown, onKeyUp, visible: visibleProp, defaultVisible = false, onVisibleChange, labels: labelsOverride, ...props },
	ref,
): React.JSX.Element {
	const labels = useUiKitLabels("passwordInput", labelsOverride);
	const [visibleState, setVisibleState] = React.useState(defaultVisible);
	const isVisibilityControlled = visibleProp !== undefined;
	const visible = isVisibilityControlled ? visibleProp : visibleState;
	const [capsLock, setCapsLock] = React.useState(false);

	const handleToggle = React.useCallback((): void => {
		const next = !visible;
		if (!isVisibilityControlled) {
			setVisibleState(next);
		}
		onVisibleChange?.(next);
	}, [isVisibilityControlled, onVisibleChange, visible]);

	// Caps Lock is reported per-keypress via `getModifierState` (a KeyboardEvent
	// API — not available on focus), so the hint appears as soon as the user
	// starts typing with Caps Lock on.
	const handleCapsLockChange = React.useCallback((event: React.KeyboardEvent<HTMLInputElement>): void => {
		setCapsLock(event.getModifierState("CapsLock"));
	}, []);

	// Compose the internal caps-lock detection with consumer handlers instead of
	// clobbering them (the spread `{...props}` comes first, so the explicit
	// props below — including the visibility-driven `type` — always win, but
	// never at the consumer's expense).
	const handleKeyDown = React.useCallback(
		(event: React.KeyboardEvent<HTMLInputElement>): void => {
			handleCapsLockChange(event);
			onKeyDown?.(event);
		},
		[handleCapsLockChange, onKeyDown],
	);

	const handleKeyUp = React.useCallback(
		(event: React.KeyboardEvent<HTMLInputElement>): void => {
			handleCapsLockChange(event);
			onKeyUp?.(event);
		},
		[handleCapsLockChange, onKeyUp],
	);

	// Tabbing away with Caps Lock on must not leave a stale warning behind.
	const handleBlur = React.useCallback(
		(event: React.FocusEvent<HTMLInputElement>): void => {
			setCapsLock(false);
			onBlur?.(event);
		},
		[onBlur],
	);

	const toggleLabel = visible ? labels.hide : labels.show;

	return (
		<div className="space-y-1.5">
			<InputGroup>
				<InputGroupInput
					{...props}
					ref={ref}
					type={visible ? "text" : "password"}
					onChange={onChange}
					onBlur={handleBlur}
					onFocus={onFocus}
					onKeyDown={handleKeyDown}
					onKeyUp={handleKeyUp}
					className={className}
				/>
				<InputGroupAddon align="inline-end">
					<InputGroupButton type="button" variant="ghost" size="icon-xs" onClick={handleToggle} aria-label={toggleLabel} title={toggleLabel} tabIndex={-1}>
						{visible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
					</InputGroupButton>
				</InputGroupAddon>
			</InputGroup>

			{capsLock ? (
				<p role="status" data-slot="password-input-caps-lock" className="flex items-center gap-1.5 text-xs text-warning-foreground">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5" aria-hidden="true">
						<path d="M12 2v8" />
						<path d="m4.93 10.93 1.41 1.41" />
						<path d="M2 18h2" />
						<path d="M20 18h2" />
						<path d="m19.07 10.93-1.41 1.41" />
						<path d="M22 22H2" />
						<path d="m8 6 4-4 4 4" />
						<path d="M16 18a4 4 0 0 0-8 0" />
					</svg>
					{labels.capsLockOn}
				</p>
			) : null}
		</div>
	);
});

export { PasswordInput };
