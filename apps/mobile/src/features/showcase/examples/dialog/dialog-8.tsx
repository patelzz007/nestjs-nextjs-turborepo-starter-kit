import { Button } from "@workspace/ui-native/components/button";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui-native/components/dialog";
import { Switch } from "@workspace/ui-native/components/switch";
import * as React from "react";
import { View } from "react-native";

const TITLE = "Cookie preferences";
const DESCRIPTION = "Choose which cookies we may use. Essential cookies keep the site working and are always on.";

interface Choices {
	readonly analytics: boolean;
	readonly marketing: boolean;
	readonly personalization: boolean;
}

const NONE: Choices = { analytics: false, marketing: false, personalization: false };
const ALL: Choices = { analytics: true, marketing: true, personalization: true };

export function Dialog8Example(): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const [choices, setChoices] = React.useState<Choices>(NONE);
	const show = React.useCallback((): void => {
		setOpen(true);
	}, []);
	const save = React.useCallback((): void => {
		setOpen(false);
	}, []);
	const acceptAll = React.useCallback((): void => {
		setChoices(ALL);
		setOpen(false);
	}, []);
	const setAnalytics = React.useCallback((analytics: boolean): void => {
		setChoices((current: Choices): Choices => ({ ...current, analytics }));
	}, []);
	const setMarketing = React.useCallback((marketing: boolean): void => {
		setChoices((current: Choices): Choices => ({ ...current, marketing }));
	}, []);
	const setPersonalization = React.useCallback((personalization: boolean): void => {
		setChoices((current: Choices): Choices => ({ ...current, personalization }));
	}, []);
	return (
		<>
			<Button label="Cookie settings" variant="outline" onPress={show} />
			<Dialog open={open} onOpenChange={setOpen} showCloseButton>
				<DialogHeader>
					<DialogTitle>{TITLE}</DialogTitle>
					<DialogDescription>{DESCRIPTION}</DialogDescription>
				</DialogHeader>
				<View className="gap-4">
					<Switch label="Essential" description="Sign-in, security and your choices here." checked disabled onChange={setAnalytics} />
					<Switch label="Analytics" description="How the site is used, counted anonymously." checked={choices.analytics} onChange={setAnalytics} />
					<Switch label="Marketing" description="Ads that match your interests." checked={choices.marketing} onChange={setMarketing} />
					<Switch label="Personalization" description="Remember your settings and suggestions." checked={choices.personalization} onChange={setPersonalization} />
				</View>
				<DialogFooter>
					<Button label="Accept all" onPress={acceptAll} />
					<Button label="Save preferences" variant="outline" onPress={save} />
				</DialogFooter>
			</Dialog>
		</>
	);
}
