## Installation

`Questionnaire` ships with the kit in `packages/ui-native/src/components/questionnaire.tsx`; there is nothing to install.

```showcase-example
c-questionnaire-1
```

## Usage

```tsx
import { Questionnaire } from "@workspace/ui-native/components/questionnaire";
```

```tsx
<Questionnaire questions={QUESTIONS} answers={answers} onAnswersChange={setAnswers} onSubmit={submit} />
```

## Several answers

```showcase-example
c-questionnaire-2
```

## Written answers and skipping

```showcase-example
c-questionnaire-3
```

```showcase-example
c-questionnaire-5
```

## Rules and branches

```showcase-example
c-questionnaire-6
```

```showcase-example
c-questionnaire-7
```

## API Reference

```showcase-api

```

## Accessibility

- The question is a header; choices are radios or checkboxes with hints.
- Progress is a polite live region; a failed rule is announced as an alert.
