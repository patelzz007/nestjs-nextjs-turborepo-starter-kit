"use client";

import { Eye, EyeOff } from "lucide-react";
import * as React from "react";

import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@workspace/ui/components/form/input-group";

import { cn } from "@workspace/ui/lib/utils";

/**
 * Password input with two UX affordances:
 * - **Show/hide toggle** — an inline eye button flips the field between
 *   `type="password"` and `type="text"`.
 * - **Caps-lock warning** — when the field has focus and Caps Lock is on, a
 *   small amber hint appears below (the classic "your password will be typed
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
const PasswordInput = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(function PasswordInput(
	{ className, onChange, onBlur, onFocus, onKeyDown, onKeyUp, ...props },
	ref,
): React.JSX.Element {
	const [visible, setVisible] = React.useState(false);
	const [capsLock, setCapsLock] = React.useState(false);

	const handleToggle = React.useCallback((): void => {
		setVisible((previous) => !previous);
	}, []);

	// Caps Lock is reported per-keypress via `getModifierState` (a KeyboardEvent
	// API — not available on focus), so the hint appears as soon as the user
	// starts typing with Caps Lock on.
	const handleCapsLockChange = React.useCallback((event: React.KeyboardEvent<HTMLInputElement>): void => {
		setCapsLock(event.getModifierState("CapsLock"));
	}, []);

	// Compose the internal caps-lock detection with consumer handlers instead of
	// clobbering them (the spread `{...props}` comes first, so the explicit
	// props below always win — but never at the consumer's expense).
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

	return (
		<div className="space-y-1.5">
			<InputGroup>
				<InputGroupInput
					ref={ref}
					type={visible ? "text" : "password"}
					onChange={onChange}
					onBlur={handleBlur}
					onFocus={onFocus}
					onKeyDown={handleKeyDown}
					onKeyUp={handleKeyUp}
					className={className}
					{...props}
				/>
				<InputGroupAddon align="inline-end">
					<InputGroupButton
						type="button"
						variant="ghost"
						size="icon-xs"
						onClick={handleToggle}
						aria-label={visible ? "Hide password" : "Show password"}
						title={visible ? "Hide password" : "Show password"}
						tabIndex={-1}>
						{visible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
					</InputGroupButton>
				</InputGroupAddon>
			</InputGroup>

			{capsLock ? (
				<p role="status" className={cn("flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400")}>
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
					Caps Lock is on
				</p>
			) : null}
		</div>
	);
});

export { PasswordInput };
