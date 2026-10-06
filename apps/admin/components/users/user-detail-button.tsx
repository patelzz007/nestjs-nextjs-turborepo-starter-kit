"use client";

import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/core/utils";
import * as React from "react";

/** Black / white inverted buttons for the user detail page (light: black bg, dark: white bg). */
export const USER_DETAIL_PAGE_BUTTON_CLASS = "border-transparent bg-foreground text-background shadow-none hover:bg-foreground/90";

type UserDetailButtonProps = React.ComponentProps<typeof Button>;

export const UserDetailButton = React.forwardRef<HTMLElement, UserDetailButtonProps>(function UserDetailButton(
	{ className, variant = "default", ...props },
	ref,
): React.JSX.Element {
	return <Button ref={ref} variant={variant} className={cn(USER_DETAIL_PAGE_BUTTON_CLASS, className)} {...props} />;
});
