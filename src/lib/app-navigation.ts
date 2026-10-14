type SoftNavigate = (path: string) => void;

let softPush: SoftNavigate | null = null;
let softReplace: SoftNavigate | null = null;

/** Wired from AppShell so in-app links can soft-navigate without a full reload. */
export function registerAppSoftNavigate(handlers: {
  push: SoftNavigate;
  replace: SoftNavigate;
} | null) {
  softPush = handlers?.push ?? null;
  softReplace = handlers?.replace ?? null;
}

export function navigateApp(path: string) {
  if (softPush) {
    softPush(path);
    return;
  }
  window.location.assign(path);
}

/** Prefer for post-submit flows so Back does not return to the finished form. */
export function replaceApp(path: string) {
  if (softReplace) {
    softReplace(path);
    return;
  }
  window.location.replace(path);
}

export function goBackOrApp(fallback = "/app") {
  if (window.history.length > 1) {
    window.history.back();
    return;
  }
  navigateApp(fallback);
}
