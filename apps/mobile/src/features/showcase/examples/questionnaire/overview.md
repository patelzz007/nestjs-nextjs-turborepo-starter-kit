## When to use

- A guided setup, a survey, an intake form
- Questions that depend on earlier answers

## When not to use

- A short form people fill in at once: use fields in a [Card](/showcase/card)
- Steps of a checkout: use [Stepper](/showcase/stepper) with forms

## Notes

- Questions are single choice or several; each choice has a letter and an optional hint
- Optional questions offer Skip; a written answer can stand in for a choice
- A rule across answers can stop the submit and open the question to change

## Questionnaire: one question at a time

`Questionnaire` takes `questions` and `answers`, and calls `onSubmit` when the last question is answered.

### Features

- **Choices.** Single or multiple, with hints.
- **Write-in.** A field that stands in for a choice.
- **Optional.** Skip, with a status you can show.
- **Conditional.** `enabled` adds questions as answers call for them.
- **Progress.** "2 of 4" or segments with step names.
- **Rules.** `validate` sends people back with a message.

## Integrating with other components

Show a [Badge](/showcase/badge) as `status`, and an [Empty](/showcase/empty) state once submitted.

## Frequently asked questions

### Can I control which question is open?

Yes: pass `step` and `onStepChange`.
