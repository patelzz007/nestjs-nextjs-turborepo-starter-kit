"use client";

import * as React from "react";
import { EyeIcon, EyeOffIcon, LogInIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Field, FieldGroup, FieldLabel, FieldSeparator } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@workspace/ui/components/input-group";

export function Card12Example(): React.JSX.Element {
	const [isVisible, setIsVisible] = useState(false);

	const handleSubmit = useCallback((event: React.SubmitEvent<HTMLFormElement>): void => {
		event.preventDefault();
	}, []);
	const toggleVisibility = useCallback((): void => {
		setIsVisible((visible: boolean): boolean => !visible);
	}, []);

	return (
		<Card className="mx-auto w-full max-w-xs">
			<CardHeader>
				<CardTitle>Sign in</CardTitle>
				<CardDescription>Enter your email and password to access your account</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit} className="grid gap-6">
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="email-12">Email address</FieldLabel>
							<Input id="email-12" type="email" placeholder="name@example.com" required />
						</Field>
						<Field>
							<div className="flex items-center justify-between">
								<FieldLabel htmlFor="password-12">Password</FieldLabel>
								<a href="#component-card" className="text-xs text-muted-foreground underline-offset-4 hover:underline">
									Forgot password?
								</a>
							</div>
							<InputGroup>
								<InputGroupInput id="password-12" placeholder="Password" type={isVisible ? "text" : "password"} required />
								<InputGroupAddon align="inline-end">
									<InputGroupButton size="icon-sm" aria-label={isVisible ? "Hide password" : "Show password"} onClick={toggleVisibility}>
										{isVisible ? <EyeOffIcon aria-hidden="true" /> : <EyeIcon aria-hidden="true" />}
									</InputGroupButton>
								</InputGroupAddon>
							</InputGroup>
						</Field>
					</FieldGroup>
					<div className="flex flex-col gap-6">
						<Button type="submit" className="w-full">
							Sign in
						</Button>
						<FieldSeparator className="text-xs">Or continue with</FieldSeparator>
						<Button variant="outline" className="w-full">
							<LogInIcon aria-hidden="true" />
							Single sign-on
						</Button>
					</div>
				</form>
			</CardContent>
			<CardFooter>
				<p className="w-full text-center text-xs text-muted-foreground">
					By clicking continue, you agree to our{" "}
					<a href="#component-card" className="underline underline-offset-4 hover:text-primary">
						Terms of Service
					</a>
				</p>
			</CardFooter>
		</Card>
	);
}
