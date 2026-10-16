"use client";

import * as React from "react";
import { EyeIcon, EyeOffIcon, LockIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { Field } from "@workspace/ui/components/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@workspace/ui/components/input-group";

export function InputGroup35Example(): React.JSX.Element {
	const [showPassword, setShowPassword] = useState(false);

	const handleToggleVisibility = useCallback((): void => {
		setShowPassword((current) => !current);
	}, []);

	return (
		<Field className="max-w-xs">
			<InputGroup>
				<InputGroupAddon>
					<LockIcon className="size-4 text-muted-foreground" />
				</InputGroupAddon>
				<InputGroupInput type={showPassword ? "text" : "password"} placeholder="Enter password" />
				<InputGroupButton variant="ghost" aria-label={showPassword ? "Hide password" : "Show password"} onClick={handleToggleVisibility}>
					{showPassword ? <EyeOffIcon className="size-4 text-muted-foreground" /> : <EyeIcon className="size-4 text-muted-foreground" />}
				</InputGroupButton>
			</InputGroup>
		</Field>
	);
}
