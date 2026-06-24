import { buildConflictChoices, type ConflictAction } from "../lib/exportDocument";

interface ConflictDialogProps {
  filePath: string;
  isDirty: boolean;
  onAction: (action: ConflictAction) => void;
}

export function ConflictDialog({ filePath, isDirty, onAction }: ConflictDialogProps) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="conflict-dialog" role="dialog" aria-modal="true" aria-label="External file change">
        <h2>File changed on disk</h2>
        <p className="conflict-path" title={filePath}>{filePath}</p>
        <p className="conflict-message">
          {isDirty
            ? "This document has unsaved edits and was also modified outside PlainMark."
            : "This document was modified outside PlainMark."}
        </p>
        <div className="conflict-actions">
          {buildConflictChoices(isDirty).map((choice) => (
            <button
              key={choice.action}
              type="button"
              className={choice.action === "reload" ? "primary" : ""}
              onClick={() => onAction(choice.action)}
              title={choice.description}
            >
              {choice.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
