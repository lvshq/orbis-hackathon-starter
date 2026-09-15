"use client";
import { ArrowUpRight } from "lucide-react";
import type { ReplyOption } from "@/lib/story";
export function ReplyChoices({
  options,
  disabled,
  onChoose,
}: {
  options: ReplyOption[];
  disabled: boolean;
  onChoose: (decision: string) => void;
}) {
  if (!options.length) return null;
  return (
    <div className="reply-choices" aria-label="Suggested replies">
      <div className="reply-choices-label">A FEW WAYS FORWARD</div>
      {options.map((option, index) => (
        <button
          key={`${index}-${option.label}`}
          type="button"
          className="reply-option"
          disabled={disabled}
          onClick={() => onChoose(option.decision)}
          aria-label={`Choose: ${option.label}`}
        >
          <span className="choice-number">{index + 1}</span>
          <span>
            <strong>{option.label}</strong>
            <small>{option.decision}</small>
          </span>
          <ArrowUpRight size={15} />
        </button>
      ))}
      <p>Or take the story somewhere else, in your own words.</p>
    </div>
  );
}
