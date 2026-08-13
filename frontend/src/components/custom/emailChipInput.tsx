import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmailChipInputProps {
  /** Comma-separated emails — same shape the backend already stores. */
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

// Loose but real email-shape check: local part, @, domain with a dot.
// Not RFC-5322 complete — just enough to catch "not an email" typos before
// they become a silent-looking chip.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function splitEmails(raw: string): string[] {
  return raw
    .split(/[,;\s]+/)
    .map(e => e.trim())
    .filter(Boolean);
}

/**
 * Gmail/Outlook-style "To:" chip input. Typing an address and hitting
 * space, comma, or Enter turns it into a removable pill; the underlying
 * value stays a comma-separated string so this drops in wherever a plain
 * <input> previously held one (no state-shape changes needed upstream).
 */
export function EmailChipInput({ value = "", onChange, placeholder, className }: EmailChipInputProps) {
  const chips = value ? value.split(",").map(e => e.trim()).filter(Boolean) : [];
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const commitChips = (candidates: string[]) => {
    const valid: string[] = [];
    const invalid: string[] = [];
    for (const candidate of candidates) {
      if (EMAIL_RE.test(candidate)) valid.push(candidate);
      else invalid.push(candidate);
    }
    if (valid.length > 0) {
      onChange([...chips, ...valid].join(","));
    }
    if (invalid.length > 0) {
      setError(`"${invalid.join(", ")}" doesn't look like a valid email`);
      setDraft(invalid.join(" "));
    } else {
      setDraft("");
      setError(null);
    }
  };

  const removeChip = (idx: number) => {
    onChange(chips.filter((_, i) => i !== idx).join(","));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === " " || e.key === "," || e.key === "Enter") {
      e.preventDefault();
      const raw = draft.trim();
      if (!raw) return;
      commitChips([raw]);
    } else if (e.key === "Backspace" && draft === "" && chips.length > 0) {
      // Pop the last chip back into the draft for editing, matching the
      // convention most email clients use.
      e.preventDefault();
      const last = chips[chips.length - 1];
      onChange(chips.slice(0, -1).join(","));
      setDraft(last);
      setError(null);
    } else {
      setError(null);
    }
  };

  const handleBlur = () => {
    const raw = draft.trim();
    if (raw) commitChips([raw]);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (!text || !/[,;\s]/.test(text)) return; // single token — let it land in the input normally
    e.preventDefault();
    const parts = splitEmails(text);
    if (parts.length > 0) commitChips(parts);
  };

  return (
    <div className={cn("border rounded px-2 py-1", className)}>
      <div className="flex flex-wrap items-center gap-1">
        {chips.map((email, idx) => (
          <span
            key={`${email}-${idx}`}
            className="inline-flex items-center gap-1 rounded bg-gray-100 text-gray-800 text-xs px-2 py-0.5"
          >
            {email}
            <button
              type="button"
              onClick={() => removeChip(idx)}
              className="text-gray-500 hover:text-gray-800"
              aria-label={`Remove ${email}`}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          className="flex-1 min-w-[8ch] outline-none text-sm py-0.5"
          value={draft}
          placeholder={chips.length === 0 ? placeholder : undefined}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onPaste={handlePaste}
        />
      </div>
      {error && <div className="text-red-600 text-xs mt-1">{error}</div>}
    </div>
  );
}
