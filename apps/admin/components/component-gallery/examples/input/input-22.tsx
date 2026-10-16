"use client";

import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { cn } from "@workspace/ui/lib/core/utils";
import { AlertTriangleIcon, CircleCheckIcon, InfoIcon } from "lucide-react";
import * as React from "react";
import { useCallback, useId, useState } from "react";

const MIN_PASSWORD_LENGTH = 8;
const DIGIT_PATTERN = /[0-9]/;
const SPECIAL_CHARACTER_PATTERN = /[!@#$%^&*]/;

/** How many requirements a password meets (out of three). */
function metRequirementCount(password: string): number {
	const requirements: readonly boolean[] = [password.length >= MIN_PASSWORD_LENGTH, DIGIT_PATTERN.test(password), SPECIAL_CHARACTER_PATTERN.test(password)];
	return requirements.filter(Boolean).length;
}

const STRONG_COUNT = 3;
const ALMOST_COUNT = 2;

interface PasswordStatus {
	readonly color: string;
	readonly icon: React.JSX.Element;
	readonly hint: string;
}

const EMPTY_STATUS: PasswordStatus = {
	color: "text-muted-foreground",
	icon: <InfoIcon className="size-3.5 shrink-0" />,
	hint: "Use 8+ characters with a number and a special character.",
};
const STRONG_STATUS: PasswordStatus = {
	color: "text-success",
	icon: <CircleCheckIcon className="size-3.5 shrink-0" />,
	hint: "Strong password. You're all set!",
};
const ALMOST_STATUS: PasswordStatus = {
	color: "text-warning",
	icon: <AlertTriangleIcon className="size-3.5 shrink-0" />,
	hint: "Almost there! Add the missing requirement.",
};
const WEAK_STATUS: PasswordStatus = {
	color: "text-destructive",
	icon: <AlertTriangleIcon className="size-3.5 shrink-0" />,
	hint: "Weak password. Include 8+ characters, a number, and a special character.",
};

function statusFor(password: string): PasswordStatus {
	if (password === "") {
		return EMPTY_STATUS;
	}
	const metCount = metRequirementCount(password);
	if (metCount === STRONG_COUNT) {
		return STRONG_STATUS;
	}
	if (metCount === ALMOST_COUNT) {
		return ALMOST_STATUS;
	}
	return WEAK_STATUS;
}

export function Input22Example(): React.JSX.Element {
	const id = useId();
	const [password, setPassword] = useState("");
	const { color, icon, hint } = statusFor(password);

	const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setPassword(event.target.value);
	}, []);

	return (
		<Field className="w-full max-w-xs">
			<FieldLabel htmlFor={id}>Password</FieldLabel>
			<Input id={id} type="password" value={password} onChange={handleChange} placeholder="Enter password" />
			<div className={cn("flex items-center gap-2 text-xs transition-colors duration-200", color)}>
				{icon}
				<p>{hint}</p>
			</div>
		</Field>
	);
}
