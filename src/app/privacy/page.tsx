"use client";

import { LegalDocumentPage } from "@/components/legal-document";
import { privacyByLocale } from "@/content/legal";

export default function PrivacyPage() {
  return (
    <LegalDocumentPage
      documentByLocale={privacyByLocale}
      otherHref="/terms"
      otherLabelKey="legal.terms"
    />
  );
}