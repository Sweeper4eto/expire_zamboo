"use client";

import { useCallback, useState } from "react";
import { useWizardBrowserBack } from "@/lib/browser-back";

type UseWizardStepOptions<T extends string> = {
  initialStep: T;
  getPreviousStep?: (step: T) => T | null;
};

/** In-memory wizard steps — avoids router.push on the same page, which breaks tab navigation. */
export function useWizardStep<T extends string>({
  initialStep,
  getPreviousStep,
}: UseWizardStepOptions<T>) {
  const [step, setStep] = useState(initialStep);

  const goToStep = useCallback((nextStep: T) => {
    setStep(nextStep);
  }, []);

  const { goBack } = useWizardBrowserBack(step, goToStep, {
    initialStep,
    getPreviousStep: getPreviousStep ?? (() => null),
  });

  return { step, goToStep, goBack };
}
