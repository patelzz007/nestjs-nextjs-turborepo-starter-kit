"use client";

import * as React from "react";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { QrCode } from "@workspace/ui/components/qr-code";

const DEFAULT_VALUE = "https://acme.example/claim/R-2026-0042";
const QR_SIZE_PX = 160;

export function QrCode1Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>(DEFAULT_VALUE);

	const handleChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setValue(event.currentTarget.value);
	}, []);

	return (
		<div className="flex w-full max-w-md flex-col gap-4">
			<div className="flex flex-col gap-1.5">
				<Label htmlFor="usage-qr-value">Encoded value</Label>
				<Input id="usage-qr-value" value={value} onChange={handleChange} />
			</div>
			<QrCode value={value.length > 0 ? value : DEFAULT_VALUE} size={QR_SIZE_PX} label="QR code of the encoded value" />
		</div>
	);
}
