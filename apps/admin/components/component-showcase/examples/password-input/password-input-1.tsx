"use client";

import * as React from "react";
import { Label } from "@workspace/ui/components/label";
import { PasswordInput } from "@workspace/ui/components/password-input";

export function PasswordInput1Example(): React.JSX.Element {
	const [password, setPassword] = React.useState<string>("");
	const [isVisible, setIsVisible] = React.useState<boolean>(false);

	const handleChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setPassword(event.currentTarget.value);
	}, []);

	return (
		<div className="flex w-full max-w-xs flex-col gap-1.5">
			<Label htmlFor="usage-password">Password</Label>
			<PasswordInput id="usage-password" value={password} onChange={handleChange} visible={isVisible} onVisibleChange={setIsVisible} autoComplete="new-password" />
		</div>
	);
}
