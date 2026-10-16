import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";

export function Tabs3Example(): React.JSX.Element {
	return (
		<div className="w-full max-w-lg">
			<Tabs defaultValue="account" orientation="vertical" className="gap-5">
				<TabsList className="w-40 shrink-0">
					<TabsTrigger value="account">Account</TabsTrigger>
					<TabsTrigger value="password">Password</TabsTrigger>
					<TabsTrigger value="settings">Settings</TabsTrigger>
				</TabsList>
				<TabsContent value="account">
					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="text-base">Account</CardTitle>
							<CardDescription className="text-sm">Update your account information.</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="vertical-name" className="text-sm">
									Name
								</Label>
								<Input id="vertical-name" defaultValue="Emma Wilson" className="h-9" />
							</div>
							<div className="space-y-2">
								<Label htmlFor="vertical-email" className="text-sm">
									Email
								</Label>
								<Input id="vertical-email" type="email" defaultValue="emma.wilson@example.com" className="h-9" />
							</div>
						</CardContent>
						<CardFooter className="pt-3">
							<Button size="sm">Save changes</Button>
						</CardFooter>
					</Card>
				</TabsContent>
				<TabsContent value="password">
					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="text-base">Password</CardTitle>
							<CardDescription className="text-sm">Change your password here.</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="vertical-current" className="text-sm">
									Current password
								</Label>
								<Input id="vertical-current" type="password" className="h-9" />
							</div>
							<div className="space-y-2">
								<Label htmlFor="vertical-new" className="text-sm">
									New password
								</Label>
								<Input id="vertical-new" type="password" className="h-9" />
							</div>
						</CardContent>
						<CardFooter className="pt-3">
							<Button size="sm">Update password</Button>
						</CardFooter>
					</Card>
				</TabsContent>
				<TabsContent value="settings">
					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="text-base">Settings</CardTitle>
							<CardDescription className="text-sm">Manage your preferences.</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="vertical-theme" className="text-sm">
									Theme
								</Label>
								<Input id="vertical-theme" defaultValue="Light" className="h-9" />
							</div>
							<div className="space-y-2">
								<Label htmlFor="vertical-language" className="text-sm">
									Language
								</Label>
								<Input id="vertical-language" defaultValue="English" className="h-9" />
							</div>
						</CardContent>
						<CardFooter className="pt-3">
							<Button size="sm">Save settings</Button>
						</CardFooter>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}
