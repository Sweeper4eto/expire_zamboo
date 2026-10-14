import type { LegalDocument } from "./types";
import type { MobileLocale } from "@/lib/client-locale";
import termsJson from "./terms.json";
import privacyJson from "./privacy.json";

export type { LegalDocument, LegalSection } from "./types";

export const termsByLocale = termsJson as Record<MobileLocale, LegalDocument>;
export const privacyByLocale = privacyJson as Record<MobileLocale, LegalDocument>;