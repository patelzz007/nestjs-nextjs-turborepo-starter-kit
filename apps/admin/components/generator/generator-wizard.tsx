"use client";

import type { DiscoveredModel, GeneratorUiModuleListItem, ResourceGeneratorApplyResult, ResourceGeneratorPreview } from "@workspace/cli/generator";
import { Button } from "@workspace/ui/components/form/button";
import { toastMessage } from "@workspace/ui/components/feedback/toast";
import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { GeneratorStepper } from "@/components/generator/generator-stepper";
import { GeneratorAccessStep } from "@/components/generator/steps/access-step";
import { GeneratorBasicsStep } from "@/components/generator/steps/basics-step";
import { GeneratorFieldsStep } from "@/components/generator/steps/fields-step";
import { GeneratorGenerateStep } from "@/components/generator/steps/generate-step";
import { GeneratorPreviewStep } from "@/components/generator/steps/preview-step";
import { GeneratorScopeStep } from "@/components/generator/steps/scope-step";
import { applyGeneratorResourceAction, previewGeneratorResourceAction } from "@/lib/generator/actions";
import {
	clearWizardDraftFromStorage,
	createEmptyWizardDraft,
	GENERATOR_WIZARD_STEPS,
	loadWizardDraftFromStorage,
	saveWizardDraftToStorage,
	validateBasicsStep,
	validateFieldsStep,
	validateScopeStep,
	wizardDraftToInput,
	type GeneratorWizardDraft,
	type WizardStepId,
} from "@/lib/generator/wizard-draft";

export interface GeneratorWizardProps {
	readonly parentModels: readonly DiscoveredModel[];
	readonly uiModules: readonly GeneratorUiModuleListItem[];
}

export function GeneratorWizard({ parentModels, uiModules }: GeneratorWizardProps): React.JSX.Element {
	const persistedDraft = React.useMemo(() => loadWizardDraftFromStorage(), []);
	const [draft, setDraft] = React.useState<GeneratorWizardDraft>(persistedDraft?.draft ?? createEmptyWizardDraft);
	const [currentStepId, setCurrentStepId] = React.useState<WizardStepId["id"]>(persistedDraft?.currentStepId ?? "basics");
	const [completedStepIds, setCompletedStepIds] = React.useState<ReadonlySet<WizardStepId["id"]>>(new Set());
	const [preview, setPreview] = React.useState<ResourceGeneratorPreview | null>(null);
	const [previewLoading, setPreviewLoading] = React.useState(false);
	const [previewError, setPreviewError] = React.useState<string | null>(null);
	const [applyResult, setApplyResult] = React.useState<ResourceGeneratorApplyResult | null>(null);
	const [applying, setApplying] = React.useState(false);
	const [applyError, setApplyError] = React.useState<string | null>(null);
	const [attemptedSteps, setAttemptedSteps] = React.useState<ReadonlySet<WizardStepId["id"]>>(new Set());

	const currentStepIndex = GENERATOR_WIZARD_STEPS.findIndex((step) => step.id === currentStepId);
	const isFirstStep = currentStepIndex <= 0;
	const isLastStep = currentStepIndex >= GENERATOR_WIZARD_STEPS.length - 1;

	const basicsError = attemptedSteps.has("basics") || currentStepId === "basics" ? validateBasicsStep(draft) : null;
	const scopeError = attemptedSteps.has("scope") || currentStepId === "scope" ? validateScopeStep(draft) : null;
	const fieldsError = attemptedSteps.has("fields") || currentStepId === "fields" ? validateFieldsStep(draft) : null;

	React.useEffect(() => {
		saveWizardDraftToStorage(draft, currentStepId);
	}, [draft, currentStepId]);

	React.useEffect(() => {
		const timeoutId = window.setTimeout((): void => {
			setPreview(null);
			setPreviewError(null);
			setApplyResult(null);
			setApplyError(null);
			setCompletedStepIds(new Set());
		}, 0);
		return (): void => {
			window.clearTimeout(timeoutId);
		};
	}, [draft]);

	const loadPreview = React.useCallback(async (nextDraft: GeneratorWizardDraft): Promise<ResourceGeneratorPreview | null> => {
		setPreviewLoading(true);
		setPreviewError(null);
		try {
			const input = wizardDraftToInput(nextDraft);
			const result = await previewGeneratorResourceAction(input);
			setPreview(result);
			return result;
		} catch (error) {
			const message = error instanceof Error ? error.message : "Failed to build preview.";
			setPreviewError(message);
			setPreview(null);
			return null;
		} finally {
			setPreviewLoading(false);
		}
	}, []);

	const validateCurrentStep = (): string | null => {
		if (currentStepId === "basics") {
			return validateBasicsStep(draft);
		}
		if (currentStepId === "scope") {
			return validateScopeStep(draft);
		}
		if (currentStepId === "fields") {
			return validateFieldsStep(draft);
		}
		return null;
	};

	const goToStep = (stepId: WizardStepId["id"]): void => {
		setCurrentStepId(stepId);
	};

	const handleNext = async (): Promise<void> => {
		setAttemptedSteps((previous) => new Set([...previous, currentStepId]));
		const validationError = validateCurrentStep();
		if (validationError !== null) {
			toastMessage.error({ title: "Check your input", description: validationError });
			return;
		}

		setCompletedStepIds((previous) => new Set([...previous, currentStepId]));

		if (currentStepId === "fields") {
			const nextStep = GENERATOR_WIZARD_STEPS[currentStepIndex + 1];
			if (nextStep !== undefined) {
				goToStep(nextStep.id);
			}
			await loadPreview(draft);
			return;
		}

		if (currentStepId === "preview") {
			const nextStep = GENERATOR_WIZARD_STEPS[currentStepIndex + 1];
			if (nextStep !== undefined) {
				goToStep(nextStep.id);
			}
			if (preview === null) {
				await loadPreview(draft);
			}
			return;
		}

		const nextStep = GENERATOR_WIZARD_STEPS[currentStepIndex + 1];
		if (nextStep !== undefined) {
			goToStep(nextStep.id);
		}
	};

	const handleBack = (): void => {
		const previousStep = GENERATOR_WIZARD_STEPS[currentStepIndex - 1];
		if (previousStep !== undefined) {
			goToStep(previousStep.id);
		}
	};

	const handleApply = async (): Promise<void> => {
		setApplying(true);
		setApplyError(null);
		try {
			const input = wizardDraftToInput(draft);
			const result = await applyGeneratorResourceAction(input);
			setApplyResult(result);
			if (!result.success) {
				setApplyError(result.error ?? "Generation failed.");
				toastMessage.error({ title: "Generation failed", description: result.error ?? "Check the validation output." });
				return;
			}
			clearWizardDraftFromStorage();
			toastMessage.success({
				title: "Resource generated",
				description: `${result.slug} is ready. Run pnpm db:migrate next.`,
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : "Generation failed.";
			setApplyError(message);
			toastMessage.error({ title: "Generation failed", description: message });
		} finally {
			setApplying(false);
		}
	};

	const wizardInput = React.useMemo(() => {
		try {
			return wizardDraftToInput(draft);
		} catch {
			return null;
		}
	}, [draft]);

	return (
		<div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="font-heading text-2xl font-semibold tracking-tight">New resource</h1>
					<p className="text-sm text-muted-foreground">Define a resource, choose scope, preview the plan, and generate artifacts.</p>
				</div>
				<Button variant="outline" nativeButton={false} render={<Link href="/devtools/generator" />}>
					<ArrowLeft className="size-4" aria-hidden="true" />
					Back to generator
				</Button>
			</div>

			<GeneratorStepper steps={GENERATOR_WIZARD_STEPS} currentStepId={currentStepId} completedStepIds={completedStepIds} onStepSelect={goToStep} />

			<div className="min-h-[24rem]">
				{currentStepId === "basics" ? <GeneratorBasicsStep draft={draft} error={basicsError} onDraftChange={setDraft} /> : null}
				{currentStepId === "scope" ? <GeneratorScopeStep draft={draft} uiModules={uiModules} error={scopeError} onDraftChange={setDraft} /> : null}
				{currentStepId === "access" ? <GeneratorAccessStep draft={draft} onDraftChange={setDraft} /> : null}
				{currentStepId === "fields" ? <GeneratorFieldsStep draft={draft} parentModels={parentModels} error={fieldsError} onDraftChange={setDraft} /> : null}
				{currentStepId === "preview" ? <GeneratorPreviewStep preview={preview} loading={previewLoading} error={previewError} /> : null}
				{currentStepId === "generate" ? (
					<GeneratorGenerateStep
						preview={preview}
						wizardInput={wizardInput}
						applyResult={applyResult}
						applying={applying}
						error={applyError}
						onApply={() => {
							void handleApply();
						}}
					/>
				) : null}
			</div>

			<div className="flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:justify-between">
				<Button type="button" variant="outline" onClick={handleBack} disabled={isFirstStep}>
					<ArrowLeft className="size-4" aria-hidden="true" />
					Back
				</Button>
				{isLastStep ? null : (
					<Button type="button" onClick={() => void handleNext()}>
						Continue
						<ArrowRight className="size-4" aria-hidden="true" />
					</Button>
				)}
			</div>
		</div>
	);
}
