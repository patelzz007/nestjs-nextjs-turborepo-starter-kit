import { Avatar } from "@workspace/ui-native/components/avatar";
import { Button } from "@workspace/ui-native/components/button";
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@workspace/ui-native/components/item";
import * as React from "react";
import { View } from "react-native";

import { ALEX, SARAH, type SamplePerson } from "./item-sample";

interface Person {
	readonly person: SamplePerson;
	readonly job: string;
}

const PEOPLE: readonly Person[] = [
	{ person: ALEX, job: "Senior Software Engineer" },
	{ person: SARAH, job: "Product Designer" },
];

function FollowRow({ person, job, initiallyFollowing }: Person & { readonly initiallyFollowing: boolean }): React.JSX.Element {
	const [following, setFollowing] = React.useState(initiallyFollowing);
	const toggle = React.useCallback((): void => {
		setFollowing((current: boolean): boolean => !current);
	}, []);
	return (
		<Item variant="outline" size="xs">
			<ItemMedia>
				<Avatar name={person.name} imageUrl={person.imageUrl} size="md" />
			</ItemMedia>
			<ItemContent>
				<ItemTitle>{person.name}</ItemTitle>
				<ItemDescription>{job}</ItemDescription>
			</ItemContent>
			<ItemActions>
				<Button label={following ? "Following" : "Follow"} variant={following ? "primary" : "outline"} size="sm" onPress={toggle} />
			</ItemActions>
		</Item>
	);
}

export function Item3Example(): React.JSX.Element {
	return (
		<View className="gap-2">
			{PEOPLE.map((entry: Person, position: number): React.JSX.Element => (
				<FollowRow key={entry.person.name} person={entry.person} job={entry.job} initiallyFollowing={position > 0} />
			))}
		</View>
	);
}
