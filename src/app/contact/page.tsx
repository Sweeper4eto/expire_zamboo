"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/auth-forms";
import { BackArrowIcon, SendIcon } from "@/components/app-nav-icons";
import { BrandName } from "@/components/brand-name";
import { LanguageSwitch } from "@/components/language-switch";
import { useT } from "@/components/i18n-provider";
import { MenuSelect } from "@/components/menu-select";
import { MobileI18nProvider } from "@/components/mobile-i18n-provider";
import { validateSupportEmail } from "@/lib/register-validation";

type Topic = "bug" | "ocr" | "billing" | "other";

function ContactPageContent() {
  const { t } = useT();
  const [topic, setTopic] = useState<Topic>("other");
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [ticketId, setTicketId] = useState("");
  const [error, setError] = useState("");

  const topicOptions = [
    { value: "bug" as const, label: t("support.topicBug") },
    { value: "ocr" as const, label: t("support.topicOcr") },
    { value: "billing" as const, label: t("support.topicBilling") },
    { value: "other" as const, label: t("support.topicOther") },
  ];

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const emailError = validateSupportEmail(contact);
    if (emailError) {
      setError(t(emailError));
      return;
    }
    setSending(true);
    setError("");
    try {
      const response = await fetch("/api/support/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guest: true,
          topic,
          contact: contact.trim().toLowerCase(),
          message: message.trim(),
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? t("errors.saveFailed"));
        return;
      }
      setSent(true);
      setTicketId(String(data?.ticketId ?? ""));
      setMessage("");
      setContact("");
    } catch {
      setError(t("errors.saveFailed"));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-svh w-full min-w-0 max-w-lg flex-col px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top,0px))]">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link href="/" className="inline-flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/landing/brand-mark.png?v=3"
            alt=""
            width={40}
            height={40}
            className="h-9 w-9 object-contain"
          />
          <BrandName className="text-lg" />
        </Link>
        <LanguageSwitch />
      </div>

      <h1 className="text-2xl font-semibold text-foreground">{t("support.title")}</h1>
      <p className="mt-2 text-sm text-muted">{t("support.guestSubtitle")}</p>

      <form
        className="mt-6 space-y-3 rounded-2xl border border-card-border bg-transparent p-4"
        onSubmit={onSubmit}
      >
        <div className="block text-sm font-medium text-foreground">
          {t("support.topic")}
          <MenuSelect
            label={t("support.topic")}
            value={topic}
            options={topicOptions}
            onChange={setTopic}
          />
        </div>

        <label className="block text-sm font-medium text-foreground">
          {t("support.contact")}
          <input
            type="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            className="mt-1 w-full rounded-xl border border-input-border bg-input px-3 py-2 text-base text-foreground"
            value={contact}
            required
            autoComplete="email"
            placeholder={t("support.contactPlaceholder")}
            onChange={(event) => setContact(event.target.value)}
          />
        </label>

        <label className="block text-sm font-medium text-foreground">
          {t("support.message")}
          <textarea
            className="mt-1 min-h-28 w-full rounded-xl border border-input-border bg-input px-3 py-2 text-base text-foreground"
            value={message}
            required
            minLength={8}
            placeholder={t("support.messagePlaceholder")}
            onChange={(event) => setMessage(event.target.value)}
          />
        </label>

        {sent ? (
          <p className="text-sm text-success-fg">
            {t("support.sent")}
            {ticketId ? ` #${ticketId.slice(0, 8)}` : ""}
          </p>
        ) : null}
        {error ? <p className="text-sm text-error">{error}</p> : null}

        <div className="flex flex-col gap-2">
          <PrimaryButton
            type="submit"
            disabled={
              sending ||
              !message.trim() ||
              Boolean(validateSupportEmail(contact))
            }
            icon={<SendIcon className="size-4 shrink-0" />}
          >
            {sending ? t("support.sending") : t("support.send")}
          </PrimaryButton>
          <Link href="/">
            <SecondaryButton
              type="button"
              icon={<BackArrowIcon className="size-4 shrink-0" />}
            >
              {t("common.back")}
            </SecondaryButton>
          </Link>
        </div>
      </form>
    </div>
  );
}

export default function ContactPage() {
  return (
    <MobileI18nProvider>
      <ContactPageContent />
    </MobileI18nProvider>
  );
}