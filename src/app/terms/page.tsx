"use client";

import { LegalDocumentPage } from "@/components/legal-document";
import { termsByLocale } from "@/content/legal";

export default function TermsPage() {
  return (
    <LegalDocumentPage
      documentByLocale={termsByLocale}
      otherHref="/privacy"
      otherLabelKey="legal.privacy"
    />
  );
}