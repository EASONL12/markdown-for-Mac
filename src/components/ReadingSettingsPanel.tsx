import type { ReadingSettings } from "../lib/readingSettings";
import type { PersistedViewMode } from "../lib/session";

interface ReadingSettingsPanelProps {
  onClose: () => void;
  onSettingsChange: (settings: ReadingSettings) => void;
  settings: ReadingSettings;
}

const defaultViewModes: PersistedViewMode[] = ["edit", "split", "preview", "read"];

export function ReadingSettingsPanel({
  onClose,
  onSettingsChange,
  settings
}: ReadingSettingsPanelProps) {
  return (
    <section className="settings-panel" aria-label="Reading settings">
      <div className="settings-header">
        <h2>Reading Settings</h2>
        <button type="button" onClick={onClose}>Close</button>
      </div>

      <label className="settings-control">
        <span>Font size</span>
        <input
          type="range"
          min="13"
          max="22"
          step="1"
          value={settings.fontSize}
          onInput={(event) => onSettingsChange({ ...settings, fontSize: Number(event.currentTarget.value) })}
        />
        <output>{settings.fontSize}px</output>
      </label>

      <label className="settings-control">
        <span>Line height</span>
        <input
          type="range"
          min="1.4"
          max="2.1"
          step="0.05"
          value={settings.lineHeight}
          onInput={(event) => onSettingsChange({ ...settings, lineHeight: Number(event.currentTarget.value) })}
        />
        <output>{settings.lineHeight.toFixed(2)}</output>
      </label>

      <label className="settings-control">
        <span>Reading width</span>
        <input
          type="range"
          min="560"
          max="1100"
          step="20"
          value={settings.readingWidth}
          onInput={(event) => onSettingsChange({ ...settings, readingWidth: Number(event.currentTarget.value) })}
        />
        <output>{settings.readingWidth}px</output>
      </label>

      <label className="settings-control">
        <span>Default view</span>
        <select
          value={settings.defaultViewMode}
          onChange={(event) => onSettingsChange({
            ...settings,
            defaultViewMode: event.target.value as PersistedViewMode
          })}
        >
          {defaultViewModes.map((mode) => (
            <option key={mode} value={mode}>{mode}</option>
          ))}
        </select>
      </label>

      <label className="settings-check">
        <input
          type="checkbox"
          checked={settings.autoSave}
          onChange={(event) => onSettingsChange({ ...settings, autoSave: event.target.checked })}
        />
        <span>Auto-save local files</span>
      </label>
    </section>
  );
}
