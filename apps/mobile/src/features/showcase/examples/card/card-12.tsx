import { Button } from "@workspace/ui-native/components/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui-native/components/card";
import { Field } from "@workspace/ui-native/components/field";
import { Input } from "@workspace/ui-native/components/input";
import { PasswordInput } from "@workspace/ui-native/components/password-input";
import { Separator } from "@workspace/ui-native/components/separator";
import { TextLink } from "@workspace/ui-native/components/text-link";
import LogInIcon from "lucide-react-native/icons/log-in";
import * as React from "react";
import { Text, View } from "react-native";

import { ignorePress } from "../example-support";

const TITLE = "Sign in";
const DESCRIPTION = "Enter your email and password to access your account";

export function Card12Example(): React.JSX.Element {
	const [email, setEmail] = React.useState("");
	const [password, setPassword] = React.useState("");
	const [visible, setVisible] = React.useState(false);
	return (
		<Card>
			<CardHeader>
				<CardTitle>{TITLE}</CardTitle>
				<CardDescription>{DESCRIPTION}</CardDescription>
			</CardHeader>
			<CardContent className="gap-6">
				<View className="gap-4">
					<Field label="Email address">
						<Input value={email} onChange={setEmail} placeholder="name@example.com" keyboardType="email-address" autoCapitalize="none" accessibilityLabel="Email address" />
					</Field>
					<View className="gap-1">
						<Field label="Password">
							<PasswordInput value={password} onChange={setPassword} visible={visible} onVisibleChange={setVisible} />
						</Field>
						<TextLink label="Forgot password?" variant="muted" size="sm" onPress={ignorePress} className="justify-end" />
					</View>
				</View>
				<Button label="Sign in" onPress={ignorePress} />
				<View className="flex-row items-center gap-2">
					<Separator className="flex-1" />
					<Text className="text-caption font-sans text-muted-foreground">Or continue with</Text>
					<Separator className="flex-1" />
				</View>
				<Button label="Single sign-on" variant="outline" icon={LogInIcon} onPress={ignorePress} />
			</CardContent>
			<CardFooter>
				<TextLink leadIn="By clicking continue, you agree to our" label="Terms of Service" variant="muted" size="sm" onPress={ignorePress} className="flex-1 justify-center" />
			</CardFooter>
		</Card>
	);
}
