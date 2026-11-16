import { Button } from "@workspace/ui-native/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui-native/components/card";
import { TextField } from "@workspace/ui-native/components/text-field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui-native/components/tabs";
import * as React from "react";

import { ignorePress } from "../example-support";

const ACCOUNT = "Account";
const ACCOUNT_TEXT = "Change your name and email.";
const PASSWORD = "Password";
const PASSWORD_TEXT = "Change your password here.";

export function Tabs1Example(): React.JSX.Element {
	const [tab, setTab] = React.useState("account");
	const [name, setName] = React.useState("Ava Patel");
	const [password, setPassword] = React.useState("");
	return (
		<Tabs value={tab} onChange={setTab}>
			<TabsList accessibilityLabel="Settings sections">
				<TabsTrigger value="account" label="Account" />
				<TabsTrigger value="password" label="Password" />
			</TabsList>
			<TabsContent value="account">
				<Card>
					<CardHeader>
						<CardTitle>{ACCOUNT}</CardTitle>
						<CardDescription>{ACCOUNT_TEXT}</CardDescription>
					</CardHeader>
					<CardContent className="gap-3">
						<TextField label="Name" value={name} onChange={setName} />
						<Button label="Save changes" onPress={ignorePress} />
					</CardContent>
				</Card>
			</TabsContent>
			<TabsContent value="password">
				<Card>
					<CardHeader>
						<CardTitle>{PASSWORD}</CardTitle>
						<CardDescription>{PASSWORD_TEXT}</CardDescription>
					</CardHeader>
					<CardContent className="gap-3">
						<TextField label="Current password" value={password} onChange={setPassword} secureTextEntry />
						<Button label="Change password" onPress={ignorePress} />
					</CardContent>
				</Card>
			</TabsContent>
		</Tabs>
	);
}
