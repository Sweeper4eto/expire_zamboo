import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import {
  dismissPwaInstallPrompt,
  PWA_INSTALL_DISMISS_MS,
  shouldOfferPwaInstall,
  wasPwaInstallDismissed,
} from "../src/lib/pwa-install";

const DISMISS_KEY = "expire365-pwa-install-dismissed";

const memory = new Map<string, string>();

function installStorageMock() {
  const storage = {
    getItem(key: string) {
      return memory.has(key) ? memory.get(key)! : null;
    },
    setItem(key: string, value: string) {
      memory.set(key, String(value));
    },
    removeItem(key: string) {
      memory.delete(key);
    },
    clear() {
      memory.clear();
    },
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: storage,
      sessionStorage: storage,
      matchMedia: () => ({ matches: false }),
      navigator: { userAgent: "test", standalone: false },
      dispatchEvent: () => true,
    },
  });
}

afterEach(() => {
  memory.clear();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (globalThis as any).window;
});

describe("pwa install dismiss window", () => {
  test("dismiss blocks offers for one week only", () => {
    installStorageMock();
    const t0 = 1_700_000_000_000;
    dismissPwaInstallPrompt(t0);
    assert.equal(wasPwaInstallDismissed(t0 + 1000), true);
    assert.equal(shouldOfferPwaInstall(t0 + 1000), false);

    const afterWeek = t0 + PWA_INSTALL_DISMISS_MS;
    assert.equal(wasPwaInstallDismissed(afterWeek), false);
    assert.equal(shouldOfferPwaInstall(afterWeek), true);
    assert.equal(memory.has(DISMISS_KEY), false);
  });

  test("legacy forever dismiss flag is cleared so we can re-offer", () => {
    installStorageMock();
    memory.set(DISMISS_KEY, "1");
    assert.equal(wasPwaInstallDismissed(Date.now()), false);
    assert.equal(shouldOfferPwaInstall(Date.now()), true);
    assert.equal(memory.has(DISMISS_KEY), false);
  });
});
