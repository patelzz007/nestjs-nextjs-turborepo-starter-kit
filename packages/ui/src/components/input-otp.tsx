"use client";

import { cn } from "@workspace/ui/lib/core/utils";
import { OTPInput, OTPInputContext } from "input-otp";
import { MinusIcon } from "lucide-react";
import * as React from "react";

/** A one-time-code field on the `input-otp` library: one real input (so typing, paste and SMS autofill work) drawn as slots. `maxLength` sets the slots; `pattern` limits what can be typed. */
const InputOTP = React.forwardRef<
	HTMLInputElement,
	React.ComponentProps<typeof OTPInput> & {
		containerClassName?: string;
	}
>(function InputOTP({ className, containerClassName, ...props }, ref): React.JSX.Element {
	return (
		<OTPInput
			ref={ref}
			data-slot="input-otp"
			containerClassName={cn("cn-input-otp flex items-center has-disabled:opacity-50", containerClassName)}
			spellCheck={false}
			className={cn("disabled:cursor-not-allowed", className)}
			{...props}
		/>
	);
});

/** A run of slots drawn as one joined box. */
const InputOTPGroup = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(function InputOTPGroup({ className, ...props }, ref): React.JSX.Element {
	return (
		<div
			ref={ref}
			data-slot="input-otp-group"
			className={cn(
				"flex items-center rounded-md has-aria-invalid:border-destructive has-aria-invalid:ring-3 has-aria-invalid:ring-destructive/20 dark:has-aria-invalid:ring-destructive/40",
				className,
			)}
			{...props}
		/>
	);
});

/** One character of the code, with a caret while it is the active slot. Set `aria-invalid` to show a rejected code. */
const InputOTPSlot = React.forwardRef<
	HTMLDivElement,
	React.ComponentProps<"div"> & {
		/** Which character of the code this slot draws, from 0. */
		index: number;
	}
>(function InputOTPSlot({ index, className, ...props }, ref): React.JSX.Element {
	const inputOTPContext = React.useContext(OTPInputContext);
	const { char, hasFakeCaret, isActive } = inputOTPContext.slots[index] ?? {};

	return (
		<div
			ref={ref}
			data-slot="input-otp-slot"
			data-active={isActive}
			className={cn(
				"relative flex size-9 items-center justify-center border-y border-e border-input text-sm shadow-xs transition-all outline-none first:rounded-s-md first:border-s last:rounded-e-md aria-invalid:border-destructive data-[active=true]:z-10 data-[active=true]:border-ring data-[active=true]:ring-3 data-[active=true]:ring-ring/50 data-[active=true]:aria-invalid:border-destructive data-[active=true]:aria-invalid:ring-destructive/20 dark:bg-input/30 dark:data-[active=true]:aria-invalid:ring-destructive/40",
				className,
			)}
			{...props}>
			{char}
			{hasFakeCaret ? (
				<div className="pointer-events-none absolute inset-0 flex items-center justify-center">
					<div className="h-4 w-px bg-foreground motion-safe:animate-caret-blink motion-safe:duration-1000" />
				</div>
			) : null}
		</div>
	);
});

/** A divider between two groups of slots. */
const InputOTPSeparator = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(function InputOTPSeparator({ className, ...props }, ref): React.JSX.Element {
	return (
		<div ref={ref} data-slot="input-otp-separator" className={cn("flex items-center [&_svg:not([class*='size-'])]:size-4", className)} role="separator" {...props}>
			<MinusIcon />
		</div>
	);
});

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator };
