"use client";

import { useCallback, useEffect, useRef } from "react";

export function pushBrowserBackEntry(): void {
  const state =
    typeof window.history.state === "object" && window.history.state !== null
      ? window.history.state
      : {};
  window.history.pushState({ ...state, __magazinBack: true }, "");
}

export type BrowserBackLayer = {
  id: string;
  open: boolean;
  close: () => void;
};

/** Sync stacked overlays/modals with the phone/browser back button. */
export function useBrowserBackStack(layers: BrowserBackLayer[]): void {
  const layersRef = useRef(layers);
  useEffect(() => {
    layersRef.current = layers;
  }, [layers]);

  const openCount = layers.filter((layer) => layer.open).length;
  const prevOpenCountRef = useRef(0);
  const suppressPopRef = useRef(false);
  const fromPopRef = useRef(false);

  useEffect(() => {
    const onPopState = () => {
      if (suppressPopRef.current) {
        suppressPopRef.current = false;
        return;
      }

      const openLayers = layersRef.current.filter((layer) => layer.open);
      const top = openLayers[openLayers.length - 1];
      if (!top) return;

      fromPopRef.current = true;
      top.close();
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const prev = prevOpenCountRef.current;

    if (fromPopRef.current) {
      fromPopRef.current = false;
      prevOpenCountRef.current = openCount;
      return;
    }

    if (openCount > prev) {
      for (let i = 0; i < openCount - prev; i++) {
        pushBrowserBackEntry();
      }
    } else if (openCount < prev) {
      for (let i = 0; i < prev - openCount; i++) {
        suppressPopRef.current = true;
        window.history.back();
      }
    }

    prevOpenCountRef.current = openCount;
  }, [openCount]);
}

type WizardBackOptions<T extends string> = {
  initialStep: T;
  getPreviousStep: (step: T) => T | null;
};

/** Sync in-page wizard steps with the phone/browser back button. */
export function useWizardBrowserBack<T extends string>(
  step: T,
  goToStep: (nextStep: T) => void,
  { initialStep, getPreviousStep }: WizardBackOptions<T>,
): { goBack: () => void } {
  const stepRef = useRef(step);
  const goToStepRef = useRef(goToStep);
  const getPreviousStepRef = useRef(getPreviousStep);

  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  useEffect(() => {
    goToStepRef.current = goToStep;
  }, [goToStep]);

  useEffect(() => {
    getPreviousStepRef.current = getPreviousStep;
  }, [getPreviousStep]);

  const prevStepRef = useRef(step);
  const fromPopRef = useRef(false);

  const goBack = useCallback(() => {
    const previous = getPreviousStepRef.current(stepRef.current);
    if (previous === null) return;
    window.history.back();
  }, []);

  useEffect(() => {
    const onPopState = () => {
      const previous = getPreviousStepRef.current(stepRef.current);
      if (previous === null) return;
      fromPopRef.current = true;
      goToStepRef.current(previous);
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (fromPopRef.current) {
      fromPopRef.current = false;
      prevStepRef.current = step;
      return;
    }

    if (step === prevStepRef.current) return;

    if (step !== initialStep) {
      pushBrowserBackEntry();
    }

    prevStepRef.current = step;
  }, [step, initialStep]);

  return { goBack };
}