import { useState } from 'react';
import {
  DEFAULT_WORKBOOK_SIZE_MIB,
  MAX_WORKBOOK_SIZE_MIB,
  getWorkbookSizeLimitMiB,
  isValidWorkbookSizeMiB,
  saveWorkbookSizeLimitMiB,
} from '../../application/persistence/workbookImportPreferences';

export function WorkbookImportSizeSettings({ disabled }: { readonly disabled: boolean }) {
  const [activeLimit, setActiveLimit] = useState(getWorkbookSizeLimitMiB);
  const [draft, setDraft] = useState(() => String(activeLimit));
  const [feedback, setFeedback] = useState<{ error: boolean; message: string } | null>(null);

  function save(value: number) {
    if (!isValidWorkbookSizeMiB(value)) {
      setFeedback({ error: true, message: `Enter a whole number from 1 to ${MAX_WORKBOOK_SIZE_MIB} MiB.` });
      return;
    }
    try {
      saveWorkbookSizeLimitMiB(value);
      setActiveLimit(value);
      setDraft(String(value));
      setFeedback({ error: false, message: `Size limit saved: ${value} MiB. You can apply the selected workbook again.` });
    } catch {
      setFeedback({ error: true, message: 'The size limit could not be saved. Allow local browser storage and try again.' });
    }
  }

  return (
    <form className="workbook-size-settings" noValidate onSubmit={(event) => {
      event.preventDefault();
      if (!disabled) save(Number(draft));
    }}>
      <label htmlFor="workbook-size-limit">Maximum workbook size (MiB)</label>
      <p id="workbook-size-limit-help">
        Active limit: {activeLimit} MiB. Choose 1–{MAX_WORKBOOK_SIZE_MIB} MiB and save for future
        imports on this browser. Larger workbooks use more memory. 1 MiB = 1,048,576 bytes.
      </p>
      <div className="workbook-size-settings-actions">
        <input id="workbook-size-limit" type="number" min="1" max={MAX_WORKBOOK_SIZE_MIB} step="1"
          value={draft} disabled={disabled} aria-describedby="workbook-size-limit-help"
          onChange={(event) => { setDraft(event.target.value); setFeedback(null); }} />
        <button className="button button-quiet" type="submit" disabled={disabled}>Save size limit</button>
        <button className="button button-quiet" type="button" disabled={disabled}
          onClick={() => save(DEFAULT_WORKBOOK_SIZE_MIB)}>Reset size limit</button>
      </div>
      {feedback && <p role={feedback.error ? 'alert' : 'status'}>{feedback.message}</p>}
    </form>
  );
}
