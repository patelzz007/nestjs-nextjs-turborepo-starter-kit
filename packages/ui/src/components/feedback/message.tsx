import { cn } from "@workspace/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

const messageGroupVariants = cva("flex min-w-0 flex-col gap-2", {
	variants: {
		variant: { default: "" },
		size: { default: "", sm: "gap-1.5 text-xs" },
		state: { default: "", loading: "opacity-60", disabled: "opacity-50", error: "" },
	},
	defaultVariants: { variant: "default", size: "default", state: "default" },
});

const MessageGroup = React.forwardRef<HTMLDivElement, React.ComponentProps<"div"> & VariantProps<typeof messageGroupVariants>>(function MessageGroup(
	{ className, variant, size, state, ...props },
	ref,
): React.JSX.Element {
	return <div ref={ref} data-slot="message-group" className={cn(messageGroupVariants({ variant, size, state }), className)} {...props} />;
});

const Message = React.forwardRef<HTMLDivElement, React.ComponentProps<"div"> & { align?: "start" | "end" }>(function Message(
	{ className, align = "start", ...props },
	ref,
): React.JSX.Element {
	return (
		<div
			ref={ref}
			data-slot="message"
			data-align={align}
			className={cn("group/message relative flex w-full min-w-0 gap-2 text-sm data-[align=end]:flex-row-reverse", className)}
			{...props}
		/>
	);
});

const MessageAvatar = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(function MessageAvatar({ className, ...props }, ref): React.JSX.Element {
	return (
		<div
			ref={ref}
			data-slot="message-avatar"
			className={cn(
				"flex w-fit min-w-8 shrink-0 items-center justify-center self-end overflow-hidden rounded-full bg-muted group-has-data-[slot=message-footer]/message:-translate-y-8",
				className,
			)}
			{...props}
		/>
	);
});

const MessageContent = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(function MessageContent({ className, ...props }, ref): React.JSX.Element {
	return (
		<div
			ref={ref}
			data-slot="message-content"
			className={cn("flex w-full min-w-0 flex-col gap-2.5 wrap-break-word group-data-[align=end]/message:*:data-slot:self-end", className)}
			{...props}
		/>
	);
});

const MessageHeader = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(function MessageHeader({ className, ...props }, ref): React.JSX.Element {
	return (
		<div
			ref={ref}
			data-slot="message-header"
			className={cn("flex max-w-full min-w-0 items-center px-3 text-xs font-medium text-muted-foreground group-has-data-[variant=ghost]/message:px-0", className)}
			{...props}
		/>
	);
});

const MessageFooter = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(function MessageFooter({ className, ...props }, ref): React.JSX.Element {
	return (
		<div
			ref={ref}
			data-slot="message-footer"
			className={cn(
				"flex max-w-full min-w-0 items-center px-3 text-xs font-medium text-muted-foreground group-has-data-[variant=ghost]/message:px-0 group-data-[align=end]/message:justify-end",
				className,
			)}
			{...props}
		/>
	);
});

export { MessageGroup, Message, MessageAvatar, MessageContent, MessageFooter, MessageHeader, messageGroupVariants };
