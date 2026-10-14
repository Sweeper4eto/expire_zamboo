const STORE_KEY = "magazin_selected_store";

export function getStoredStoreId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORE_KEY);
}

export function setStoredStoreId(storeId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORE_KEY, storeId);
  window.dispatchEvent(new Event("magazin:store-changed"));
}

export function clearStoredStoreId(): void {
  if (typeof window === "undefined") return;
  if (!localStorage.getItem(STORE_KEY)) return;
  localStorage.removeItem(STORE_KEY);
  window.dispatchEvent(new Event("magazin:store-changed"));
}
