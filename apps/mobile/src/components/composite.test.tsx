import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";

import { BackupCodes } from "./backup-codes";
import { DeviceSessionRow } from "./device-session-row";

describe("BackupCodes", () => {
	const CODES = ["AAAABBBBCCCCDDDD", "EEEEFFFFGGGGHHHH"];

	function codes(overrides: Partial<React.ComponentProps<typeof BackupCodes>> = {}): React.JSX.Element {
		return (
			<BackupCodes
				codes={CODES}
				confirmed={false}
				onConfirmedChange={jest.fn()}
				onCopy={jest.fn()}
				onShare={jest.fn()}
				onContinue={jest.fn()}
				continueLabel="Done"
				{...overrides}
			/>
		);
	}

	it("lists the codes, copies and shares them", async () => {
		const onCopy = jest.fn();
		const onShare = jest.fn();
		await render(codes({ onCopy, onShare }));

		expect(screen.getByText("AAAABBBBCCCCDDDD")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Copy all" }));
		await fireEvent.press(screen.getByRole("button", { name: "Share" }));
		expect(onCopy).toHaveBeenCalledTimes(1);
		expect(onShare).toHaveBeenCalledTimes(1);
	});

	it("requires the saved confirmation before continuing", async () => {
		const onConfirmedChange = jest.fn();
		const onContinue = jest.fn();
		const { rerender } = await render(codes({ onConfirmedChange, onContinue }));

		expect(screen.getByRole("button", { name: "Done" })).toBeDisabled();
		await fireEvent.press(screen.getByRole("checkbox", { name: "I saved my backup codes" }));
		expect(onConfirmedChange).toHaveBeenCalledWith(true);

		await rerender(codes({ confirmed: true, onConfirmedChange, onContinue }));
		await fireEvent.press(screen.getByRole("button", { name: "Done" }));
		expect(onContinue).toHaveBeenCalledTimes(1);
	});
});

describe("DeviceSessionRow", () => {
	const BASE = {
		label: "Alex’s iPhone",
		clientTypeLabel: "Mobile app",
		platform: "iPhone 15 Pro · iOS 26",
		details: [{ label: "Sign-in IP", value: "203.0.113.24" }],
		currentLabel: "This device",
		revokeLabel: "Revoke",
	};

	it("marks the current device and offers no revoke for it", async () => {
		await render(<DeviceSessionRow {...BASE} isCurrent onRevoke={jest.fn()} />);
		expect(screen.getByText("This device")).toBeOnTheScreen();
		expect(screen.queryByRole("button")).toBeNull();
	});

	it("offers revoke for another device, named after it", async () => {
		const onRevoke = jest.fn();
		await render(<DeviceSessionRow {...BASE} isCurrent={false} onRevoke={onRevoke} />);
		expect(screen.getByText("iPhone 15 Pro · iOS 26")).toBeOnTheScreen();
		expect(screen.getByLabelText("Sign-in IP: 203.0.113.24")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Revoke Alex’s iPhone" }));
		expect(onRevoke).toHaveBeenCalledTimes(1);
	});

	it("shows the revoke in progress, and hides an empty platform line", async () => {
		await render(<DeviceSessionRow {...BASE} platform="" isCurrent={false} onRevoke={jest.fn()} isRevoking />);
		expect(screen.getByRole("button", { name: "Revoke Alex’s iPhone" })).toBeBusy();
		expect(screen.queryByText("iPhone 15 Pro · iOS 26")).toBeNull();
	});
});
