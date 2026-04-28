"use client";

import { FormEvent, useMemo, useState } from "react";
import { Mail } from "lucide-react";

const FEEDBACK_EMAIL = "upek2007@gmail.com";

export function AboutFeedbackForm() {
  const [subject, setSubject] = useState("NotiStock feedback");
  const [message, setMessage] = useState("");

  const mailtoHref = useMemo(() => {
    const body = message.trim()
      ? `${message.trim()}\n\nSent from the NotiStock About page.`
      : "Hi Upek,\n\nI wanted to share feedback about NotiStock.";

    return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(
      subject.trim() || "NotiStock feedback",
    )}&body=${encodeURIComponent(body)}`;
  }, [message, subject]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    window.location.href = mailtoHref;
  }

  return (
    <form className="mx-auto mt-5 max-w-2xl space-y-3 text-left" onSubmit={handleSubmit}>
      <div>
        <label className="text-xs font-semibold uppercase text-slate-500" htmlFor="feedback-subject">
          Subject
        </label>
        <input
          className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
          id="feedback-subject"
          onChange={(event) => setSubject(event.target.value)}
          value={subject}
        />
      </div>
      <div>
        <label className="text-xs font-semibold uppercase text-slate-500" htmlFor="feedback-message">
          Message
        </label>
        <textarea
          className="mt-2 min-h-32 w-full resize-y rounded-lg border border-slate-200 px-3 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
          id="feedback-message"
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Share a note, bug, idea, or opportunity."
          value={message}
        />
      </div>
      <button
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 sm:w-auto"
        type="submit"
      >
        <Mail className="h-4 w-4" />
        Send feedback
      </button>
    </form>
  );
}
