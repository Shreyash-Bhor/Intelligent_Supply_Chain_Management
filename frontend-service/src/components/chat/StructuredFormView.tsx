"use client";

import { useRef, useState, type FormEvent } from "react";
import { validateFormValues, type StructuredFormAction } from "@/components/chat/protocol";

export function StructuredFormView({ action, onSubmit }: { action: StructuredFormAction; onSubmit: (values: Record<string, string | number | boolean>) => Promise<void> }) {
  const [values, setValues] = useState<Record<string, string | number | boolean>>(() => Object.fromEntries(action.fields.map((field) => [field.id, field.defaultValue ?? (field.type === "checkbox" ? false : "")])));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending.current || submitted) return;
    const nextErrors = validateFormValues(action.fields, values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    pending.current = true; setBusy(true); setError("");
    try { await onSubmit(values); setSubmitted(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "The form could not be submitted. Please retry."); }
    finally { pending.current = false; setBusy(false); }
  };
  const inputClass = "mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-foreground/40 focus:ring-2 focus:ring-foreground/10";
  return <section className="mt-5 rounded-2xl border border-border/80 bg-card p-5" aria-label={action.title}>
    <h3 className="text-base font-semibold tracking-tight">{action.title}</h3>
    {submitted ? <p role="status" className="mt-3 text-sm text-emerald-700">Submitted successfully.</p> : <form onSubmit={(event) => void submit(event)} className="mt-3 grid gap-3 sm:grid-cols-2">
      {action.fields.map((field) => <label key={field.id} className={`block text-sm font-medium ${field.type === "textarea" ? "sm:col-span-2" : ""}`}>
        {field.label}{field.required && <span aria-hidden="true"> *</span>}
        {field.type === "textarea" ? <textarea required={field.required} maxLength={field.maxLength} value={String(values[field.id] ?? "")} onChange={(event) => setValues((current) => ({ ...current, [field.id]: event.target.value }))} className={`${inputClass} min-h-24`} aria-invalid={!!errors[field.id]} /> : field.type === "select" ? <select required={field.required} value={String(values[field.id] ?? "")} onChange={(event) => setValues((current) => ({ ...current, [field.id]: event.target.value }))} className={inputClass}><option value="">Select…</option>{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : field.type === "radio" ? <span className="mt-2 flex flex-wrap gap-3">{field.options?.map((option) => <span key={option.value} className="inline-flex items-center gap-1.5"><input type="radio" name={`${action.title}-${field.id}`} required={field.required} checked={values[field.id] === option.value} value={option.value} onChange={() => setValues((current) => ({ ...current, [field.id]: option.value }))} />{option.label}</span>)}</span> : <input type={field.type === "checkbox" ? "checkbox" : field.type} required={field.required && field.type !== "checkbox"} checked={field.type === "checkbox" ? Boolean(values[field.id]) : undefined} min={field.min} max={field.max} maxLength={field.maxLength} value={field.type === "checkbox" ? undefined : String(values[field.id] ?? "")} onChange={(event) => setValues((current) => ({ ...current, [field.id]: field.type === "checkbox" ? event.target.checked : event.target.value }))} className={field.type === "checkbox" ? "ml-2 size-4 align-middle" : inputClass} aria-invalid={!!errors[field.id]} />}
        {errors[field.id] && <span role="alert" className="mt-1 block text-xs text-destructive">{errors[field.id]}</span>}
      </label>)}
      {error && <p role="alert" className="sm:col-span-2 text-sm text-destructive">{error}</p>}
      <button type="submit" disabled={busy} className="sm:col-span-2 min-h-11 rounded-xl bg-foreground px-4 text-sm font-semibold text-background transition hover:opacity-85 disabled:opacity-50">{busy ? "Submitting…" : "Submit"}</button>
    </form>}
  </section>;
}
