## When to use

- Onboarding and setup flows that ask one single- or multiple-answer question per screen
- Short intake surveys, such as how a visitor heard about you or what they are moving from
- Question flows with an optional step, a branch that depends on an earlier answer, or a rule across answers

## When not to use

- Steps that each hold a whole screen of mixed fields rather than one question: use [Stepper](/components/stepper)
- A bar reporting how far an upload or a task has got, with no questions: use [Progress](/components/progress)

## Notes

- A `QuestionnaireItem` whose `name` is missing from the root's `items` is left out of the flow and the count, with only a development warning
- `onSubmit` receives the answers; send them to your API from there
- `QuestionnaireActions` is a three-column grid for Previous, Skip and Next or Submit: keep other buttons outside it

## Questionnaire: one question at a time

`Questionnaire` walks people through a set of questions, one per screen, with choices, write-in answers, progress, validation and branching. It is a form underneath, so answers submit together at the end.

### What is Questionnaire?

A root that knows the ordered `items`, and one `QuestionnaireItem` per question, with a title, a description, `QuestionnaireChoices` (single or multiple), an optional `QuestionnaireInput` for "Other", an error and progress. `QuestionnaireActions` holds Previous, Skip, Next and Submit.

### Why use Questionnaire?

One question per screen keeps onboarding light and lets each answer shape what comes next. Building the flow, validation and keyboard shortcuts by hand for each survey is repetitive; the questionnaire does it once.

### Questionnaire features

- **Single and multiple choice.** With optional descriptions per choice.
- **Write-in answers.** `QuestionnaireInput` for "Other".
- **Required and optional.** `required` items, `QuestionnaireSkip` for optional ones.
- **Branching.** Skip or show questions based on earlier answers.
- **Progress.** A bar or segments, with "2 of 5" text.
- **Keyboard shortcuts.** Letters or numbers pick choices (`shortcuts`).

## Integrating with other components

Render each question in a [Card](/components/card) (titles and descriptions through `render`), show progress with [Progress](/components/progress), and confirm the result with a [Toast](/components/toast).

## Frequently asked questions

### How do I branch on an answer?

Decide the next item from the answers so far, as the Conditional Branch example does; items not reached are left out of the progress.

### How do I make a question optional?

Leave out `required` and add a `QuestionnaireSkip` to the actions.

### Can people answer with the keyboard?

Yes: `shortcuts="letters"` (or `"numbers"`) picks choices with a key, and Enter moves on.

### Is it accessible?

Each question is a group named by its title; choices are radios or checkboxes; errors are announced; progress has a text equivalent.
