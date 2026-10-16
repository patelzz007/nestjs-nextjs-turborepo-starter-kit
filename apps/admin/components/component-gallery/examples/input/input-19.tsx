"use client";

import * as React from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

export function Input19Example(): React.JSX.Element {
	const [isVisible, setIsVisible] = useState<boolean>(false);

	const toggleVisibility = useCallback((): void => {
		setIsVisible((prevState: boolean): boolean => !prevState);
	}, []);

	return (
		<Field className="w-full max-w-xs">
			<div className="flex items-center justify-between">
				<FieldLabel htmlFor="password-link">Password</FieldLabel>
				<a href="#component-input" className="text-xs font-medium text-primary hover:underline">
					Forgot password?
				</a>
			</div>
			<div className="relative">
				<Input id="password-link" type={isVisible ? "text" : "password"} className="pe-9" />
				<button
					aria-label={isVisible ? "Hide password" : "Show password"}
					aria-pressed={isVisible}
					className="absolute inset-y-0 end-0 flex h-full w-9 items-center justify-center rounded-e-md text-muted-foreground/80 transition-[color,box-shadow] outline-none hover:text-foreground focus:z-10 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
					onClick={toggleVisibility}
					type="button">
					{isVisible ? <EyeOffIcon aria-hidden="true" /> : <EyeIcon aria-hidden="true" />}
				</button>
			</div>
		</Field>
	);
}
