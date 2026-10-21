"use client";

// The reward editor's form: TanStack Form holds what the merchant typed, and the shared reward
// schema (`MerchantRewardFormFieldsSchema`, the one the API's contract derives from) decides what
// is valid. The editor's sections take a library-agnostic `RewardEditorState` (values, the
// messages to show, one setter), so they stay data-agnostic and test without a form instance.

import { useForm, useSelector } from "@tanstack/react-form";
import { LocationScopeTypeSchema, MerchantRewardFormFieldsSchema, RewardTypeSchema, type MerchantRewardFormValues } from "@workspace/shared";
import * as React from "react";
import { z } from "zod";

/**
 * What the editor holds while the merchant types. Number inputs keep their text, so typing "1."
 * never loses the dot and a cleared field reads as missing rather than 0; terms are text. Every
 * other field already has the shape the shared schema checks.
 */
export const RewardEditorInputSchema = z
	.object({
		rewardType: RewardTypeSchema,
		title: z.string(),
		description: z.string(),
		imageFileIds: z.array(z.string()),
		rewardValue: z.string(),
		minPurchase: z.string(),
		termsConditions: z.string(),
		startDate: z.string(),
		expiryDate: z.string(),
		quantityTotal: z.string(),
		maxClaimsPerUser: z.number(),
		locationScopeType: LocationScopeTypeSchema.optional(),
		locationIds: z.array(z.string()).optional(),
	})
	.strict();

export type RewardEditorInput = z.output<typeof RewardEditorInputSchema>;

/** One of the editor's fields. */
export type RewardEditorField = keyof RewardEditorInput;

/** The fields typed into a text box: one change handler serves them all, by the input's `name`. */
export const RewardEditorTextFieldSchema = z.enum(["title", "description", "termsConditions", "rewardValue", "minPurchase", "quantityTotal"]);

export type RewardEditorTextField = z.output<typeof RewardEditorTextFieldSchema>;

const RewardEditorFieldSchema = RewardEditorInputSchema.keyof();

/** A number field's text as the schema reads it: blank is `NaN` (reported missing by the schema), never 0. */
function requiredNumber(text: string): number {
	const trimmed = text.trim();
	return trimmed.length === 0 ? Number.NaN : Number(trimmed);
}

/** An optional number field's text: blank is "not given". */
function optionalNumber(text: string): number | undefined {
	const trimmed = text.trim();
	return trimmed.length === 0 ? undefined : Number(trimmed);
}

/** Optional text: blank is "not given". */
function optionalText(text: string): string | undefined {
	return text.trim().length === 0 ? undefined : text;
}

/** The typed values in the shape the shared schema checks (numbers read from their text). */
export function toRewardFormCandidate(input: RewardEditorInput): z.input<typeof MerchantRewardFormFieldsSchema> {
	return {
		rewardType: input.rewardType,
		title: input.title,
		description: input.description,
		imageFileIds: input.imageFileIds,
		rewardValue: requiredNumber(input.rewardValue),
		minPurchase: optionalNumber(input.minPurchase),
		termsConditions: optionalText(input.termsConditions),
		startDate: input.startDate,
		expiryDate: input.expiryDate,
		quantityTotal: requiredNumber(input.quantityTotal),
		maxClaimsPerUser: input.maxClaimsPerUser,
		...(input.locationScopeType === undefined ? {} : { locationScopeType: input.locationScopeType }),
		...(input.locationIds === undefined ? {} : { locationIds: input.locationIds }),
	};
}

/** Typed values → the shared reward form values, validated by the shared schema (issues keep the field names). */
export const RewardEditorFormSchema = RewardEditorInputSchema.transform(toRewardFormCandidate).pipe(MerchantRewardFormFieldsSchema);

/** A saved reward's form values as the editor holds them (the edit page's starting point). */
export function toRewardEditorInput(values: MerchantRewardFormValues): RewardEditorInput {
	return {
		rewardType: values.rewardType,
		title: values.title,
		description: values.description,
		imageFileIds: values.imageFileIds,
		rewardValue: String(values.rewardValue),
		minPurchase: values.minPurchase === undefined ? "" : String(values.minPurchase),
		termsConditions: values.termsConditions ?? "",
		startDate: values.startDate,
		expiryDate: values.expiryDate,
		quantityTotal: String(values.quantityTotal),
		maxClaimsPerUser: values.maxClaimsPerUser,
		...(values.locationScopeType === undefined ? {} : { locationScopeType: values.locationScopeType }),
		...(values.locationIds === undefined ? {} : { locationIds: values.locationIds }),
	};
}

/** The first message the shared schema has for each field, in the merchant's words; empty once the values are valid. */
export type RewardEditorErrors = Readonly<Partial<Record<RewardEditorField, string>>>;

export function rewardEditorErrors(input: RewardEditorInput): RewardEditorErrors {
	const result = RewardEditorFormSchema.safeParse(input);
	if (result.success) {
		return {};
	}
	const errors: Partial<Record<RewardEditorField, string>> = {};
	for (const issue of result.error.issues) {
		const [head] = issue.path;
		const field = RewardEditorFieldSchema.safeParse(head);
		if (field.success && errors[field.data] === undefined) {
			errors[field.data] = issue.message;
		}
	}
	return errors;
}

/** What the editor's sections read and change: the typed values, the messages to show, and one setter. */
export interface RewardEditorState {
	readonly values: RewardEditorInput;
	/** Shown once the merchant tried to save, then kept current as they fix things. */
	readonly errors: RewardEditorErrors;
	readonly setField: <TField extends RewardEditorField>(field: TField, value: RewardEditorInput[TField]) => void;
}

/** A setter for each field, keyed by the field. */
type RewardEditorSetters = { readonly [TField in RewardEditorField]: (value: RewardEditorInput[TField], options?: SetFieldOptions) => void };

/** `dontUpdateMeta`: the value is the server's, not the merchant's edit (the field stays untouched). */
interface SetFieldOptions {
	readonly dontUpdateMeta: boolean;
}

/** Every editor field, for walking the values field by field. */
const REWARD_EDITOR_FIELDS: readonly RewardEditorField[] = RewardEditorInputSchema.keyof().options;

/** Whether two values of one field are the same: arrays element by element, everything else by identity. */
function sameFieldValue(left: RewardEditorInput[RewardEditorField], right: RewardEditorInput[RewardEditorField]): boolean {
	const leftList = z.array(z.string()).safeParse(left);
	const rightList = z.array(z.string()).safeParse(right);
	if (leftList.success && rightList.success) {
		return leftList.data.length === rightList.data.length && leftList.data.every((item, index) => item === rightList.data.at(index));
	}
	return left === right;
}

export interface UseRewardEditorFormOptions<TMeta> {
	/** The starting values. A change (the server's reward refetched) is taken over while the merchant has not touched the form. */
	readonly defaultValues: RewardEditorInput;
	/** What a submit carries when it names nothing (the create page's save intent). */
	readonly defaultMeta: TMeta;
	/** Called with the shared-schema output once every field is valid. */
	readonly onValid: (values: MerchantRewardFormValues, meta: TMeta) => void;
}

export interface RewardEditorForm<TMeta> {
	readonly editor: RewardEditorState;
	/** Validates and, when valid, calls `onValid` with `meta`. */
	readonly submit: (meta: TMeta) => Promise<void>;
}

/** Sets `field` to its new starting value without marking it edited. */
function adoptDefault<TField extends RewardEditorField>(setters: RewardEditorSetters, field: TField, value: RewardEditorInput[TField]): void {
	setters[field](value, { dontUpdateMeta: true });
}

/** The reward editor's form instance: TanStack Form, validated by the shared reward schema on change and on submit. */
export function useRewardEditorForm<TMeta>({ defaultValues, defaultMeta, onValid }: UseRewardEditorFormOptions<TMeta>): RewardEditorForm<TMeta> {
	const form = useForm({
		defaultValues,
		onSubmitMeta: defaultMeta,
		validators: { onChange: RewardEditorFormSchema, onSubmit: RewardEditorFormSchema },
		onSubmit: ({ value, meta }): void => {
			onValid(RewardEditorFormSchema.parse(value), meta);
		},
	});
	const values = useSelector(form.store, (state) => state.values);
	const submissionAttempts = useSelector(form.store, (state) => state.submissionAttempts);
	const errors = React.useMemo((): RewardEditorErrors => (submissionAttempts > 0 ? rewardEditorErrors(values) : {}), [submissionAttempts, values]);

	// One typed setter per field: TanStack's path typing cannot relate a generic field name to its value.
	const setters = React.useMemo(
		(): RewardEditorSetters => ({
			rewardType: (value, options): void => {
				form.setFieldValue("rewardType", value, options);
			},
			title: (value, options): void => {
				form.setFieldValue("title", value, options);
			},
			description: (value, options): void => {
				form.setFieldValue("description", value, options);
			},
			imageFileIds: (value, options): void => {
				form.setFieldValue("imageFileIds", value, options);
			},
			rewardValue: (value, options): void => {
				form.setFieldValue("rewardValue", value, options);
			},
			minPurchase: (value, options): void => {
				form.setFieldValue("minPurchase", value, options);
			},
			termsConditions: (value, options): void => {
				form.setFieldValue("termsConditions", value, options);
			},
			startDate: (value, options): void => {
				form.setFieldValue("startDate", value, options);
			},
			expiryDate: (value, options): void => {
				form.setFieldValue("expiryDate", value, options);
			},
			quantityTotal: (value, options): void => {
				form.setFieldValue("quantityTotal", value, options);
			},
			maxClaimsPerUser: (value, options): void => {
				form.setFieldValue("maxClaimsPerUser", value, options);
			},
			locationScopeType: (value, options): void => {
				form.setFieldValue("locationScopeType", value, options);
			},
			locationIds: (value, options): void => {
				form.setFieldValue("locationIds", value, options);
			},
		}),
		[form],
	);
	// A new starting value (the server's reward refetched) replaces each field the merchant has not
	// changed from the previous one, and leaves every edited field as they typed it.
	const previousDefaults = React.useRef(defaultValues);
	React.useEffect((): void => {
		const previous = previousDefaults.current;
		if (previous === defaultValues) {
			return;
		}
		previousDefaults.current = defaultValues;
		for (const field of REWARD_EDITOR_FIELDS) {
			if (sameFieldValue(form.getFieldValue(field), previous[field]) && !sameFieldValue(previous[field], defaultValues[field])) {
				adoptDefault(setters, field, defaultValues[field]);
			}
		}
	}, [defaultValues, form, setters]);

	const setField = React.useCallback(
		<TField extends RewardEditorField>(field: TField, value: RewardEditorInput[TField]): void => {
			setters[field](value);
		},
		[setters],
	);
	const submit = React.useCallback((meta: TMeta): Promise<void> => form.handleSubmit(meta), [form]);
	const editor = React.useMemo((): RewardEditorState => ({ values, errors, setField }), [errors, setField, values]);
	return { editor, submit };
}
