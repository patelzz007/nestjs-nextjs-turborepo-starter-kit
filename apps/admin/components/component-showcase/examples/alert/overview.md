## When to use

- Inline status messages in the page for success, info, warning and error outcomes
- Notices that offer a next step, such as a security update, a renewal reminder or a plan upgrade
- Status rows inside a Frame panel, such as service health, deploy results and message notifications

## When not to use

- A yes/no decision that must be answered before the page goes on: use [Alert Dialog](/components/alert-dialog)
- A brief confirmation that floats in a corner and disappears by itself: use [Toast](/components/toast)

## Notes

- `Alert` sets `role="alert"`, an assertive live region: pass `role="status"` for a notice that is not urgent
- `AlertTitle` clamps to one line, so longer copy goes in `AlertDescription`
- `Alert` has no open state or close part: a dismiss button unmounts it from state you own

## Alert: status messages in the page

`Alert` is a callout for an outcome or a risk: a title, a description, an icon and optional actions. Its variants — `default`, `info`, `success`, `warning`, `destructive` and `invert` — each bring their own colours and default icon.

### What is Alert?

A persistent message that stays in the layout until the condition changes: a failed payment, a deprecated setting, a successful import with warnings. `AlertAction` holds buttons or links that resolve it.

### Why use Alert?

Some messages must be noticed without blocking the page. An alert sits where the problem is, explains it and offers the fix, and screen readers announce it.

### Alert features

- **Six variants.** With a default icon each; your own icon replaces it, and an avatar or other media removes it.
- **Actions.** `AlertAction` for buttons and links.
- **Sizes.** `size` for dense lists.
- **Live region.** `role="alert"` by default, `status` for calm notices.

## Integrating with other components

Stack alerts in a [Frame](/components/frame), put [Button](/components/button)s in `AlertAction`, and use a [Badge](/components/badge) for a short status inside. For transient feedback, prefer a [Toast](/components/toast).

## Frequently asked questions

### Alert or Toast?

An alert stays until the problem is solved; a [Toast](/components/toast) confirms an action and goes away.

### How do I make it dismissible?

Keep its visibility in state and render a close [Button](/components/button) in `AlertAction` that hides it (and remembers that it was dismissed, if it should stay hidden).

### Is it accessible?

It is a live region (`role="alert"`, or `status`), so it is announced when it appears; its colours always come with an icon and words.
