import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@workspace/ui/components/dialog";
import { Label } from "@workspace/ui/components/label";
import { Switch } from "@workspace/ui/components/switch";

export function Dialog8Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<Dialog>
				<DialogTrigger render={<Button variant="outline" />}>Cookie Preferences</DialogTrigger>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Cookie Preferences</DialogTitle>
						<DialogDescription>You can enable or disable different categories of cookies.</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<div className="flex items-center justify-between gap-4">
							<div className="space-y-0.75">
								<Label htmlFor="cookie-essential" className="text-sm font-medium">
									Essential Cookies
								</Label>
								<p className="text-xs text-muted-foreground">Required for the website to function properly. Cannot be disabled.</p>
							</div>
							<Switch id="cookie-essential" defaultChecked disabled />
						</div>
						<div className="flex items-center justify-between gap-4">
							<div className="space-y-0.75">
								<Label htmlFor="cookie-analytics" className="text-sm font-medium">
									Analytics Cookies
								</Label>
								<p className="text-xs text-muted-foreground">Help us understand how visitors interact with our website.</p>
							</div>
							<Switch id="cookie-analytics" />
						</div>
						<div className="flex items-center justify-between gap-4">
							<div className="space-y-0.75">
								<Label htmlFor="cookie-marketing" className="text-sm font-medium">
									Marketing Cookies
								</Label>
								<p className="text-xs text-muted-foreground">Used to deliver personalized advertisements and track ad campaign performance.</p>
							</div>
							<Switch id="cookie-marketing" />
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline">Save Preferences</Button>
						<Button>Accept All</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
