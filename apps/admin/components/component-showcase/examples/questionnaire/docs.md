## Installation

The questionnaire parts ship with the kit in `packages/ui/src/components/questionnaire.tsx`; there is nothing to install. Its strings come from the `questionnaire` labels.

```showcase-example
c-questionnaire-1
```

## Usage

```tsx
import {
	Questionnaire,
	QuestionnaireActions,
	QuestionnaireChoice,
	QuestionnaireChoices,
	QuestionnaireError,
	QuestionnaireItem,
	QuestionnaireNext,
	QuestionnairePrevious,
	QuestionnaireProgress,
	QuestionnaireSubmit,
	QuestionnaireTitle,
} from "@workspace/ui/components/questionnaire";
```

```tsx
<Questionnaire items={["usage", "team"]} onSubmit={save}>
	<QuestionnaireItem name="usage" required>
		<QuestionnaireTitle>What will you use it for?</QuestionnaireTitle>
		<QuestionnaireProgress />
		<QuestionnaireChoices>
			<QuestionnaireChoice value="personal">Personal</QuestionnaireChoice>
			<QuestionnaireChoice value="work">Work</QuestionnaireChoice>
		</QuestionnaireChoices>
		<QuestionnaireError />
	</QuestionnaireItem>
	{/* …the "team" item */}
	<QuestionnaireActions>
		<QuestionnairePrevious />
		<QuestionnaireNext />
		<QuestionnaireSubmit />
	</QuestionnaireActions>
</Questionnaire>
```

## Examples

### Multi-select

```showcase-example
c-questionnaire-2
```

### Write-in answer

```showcase-example
c-questionnaire-3
```

### Optional skip

```showcase-example
c-questionnaire-5
```

### Conditional branch

```showcase-example
c-questionnaire-7
```

## API Reference

```showcase-api

```

## Accessibility

- Each question is a group named by its title; choices are native radios or checkboxes.
- `QuestionnaireError` is announced when a required question is left empty; progress has a text equivalent.
