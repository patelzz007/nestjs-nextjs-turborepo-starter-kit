import * as React from "react";
import { RefreshCwIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@workspace/ui/components/input-otp";

export function InputOtp6Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<Card className="mx-auto w-full max-w-md">
				<CardHeader>
					<CardTitle>Verify your login</CardTitle>
					<CardDescription>
						Enter the verification code we sent to your email address: <span className="font-medium text-foreground">m@example.com</span>.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form>
						<Field>
							<div className="flex items-center justify-between">
								<FieldLabel htmlFor="otp-verification">Verification code</FieldLabel>
								<Button variant="outline" size="xs">
									<RefreshCwIcon data-icon="inline-start" />
									Resend Code
								</Button>
							</div>
							<InputOTP maxLength={6} id="otp-verification" required>
								<InputOTPGroup className="*:data-[slot=input-otp-slot]:h-9 *:data-[slot=input-otp-slot]:w-11 *:data-[slot=input-otp-slot]:text-xl">
									<InputOTPSlot index={0} />
									<InputOTPSlot index={1} />
									<InputOTPSlot index={2} />
								</InputOTPGroup>
								<InputOTPSeparator />
								<InputOTPGroup className="*:data-[slot=input-otp-slot]:h-9 *:data-[slot=input-otp-slot]:w-11 *:data-[slot=input-otp-slot]:text-xl">
									<InputOTPSlot index={3} />
									<InputOTPSlot index={4} />
									<InputOTPSlot index={5} />
								</InputOTPGroup>
							</InputOTP>
						</Field>
					</form>
				</CardContent>
				<CardFooter className="flex-col gap-2">
					<Button type="submit" className="w-full">
						Verify
					</Button>
					<div className="text-muted-foreground">
						Having trouble signing in?{" "}
						<a href="mailto:support@example.com" className="text-primary underline-offset-4 transition-colors hover:underline">
							Contact support
						</a>
					</div>
				</CardFooter>
			</Card>
		</div>
	);
}
