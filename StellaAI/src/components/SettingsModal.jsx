/* =========================================================
   SETTINGS MODAL
========================================================= */

export default function SettingsModal({ onClose }) {
  return (
    <div
      className="settings-backdrop"
      onClick={onClose}
    >
      <section
        className="settings-popover"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={(e) => e.stopPropagation()}
      >

        <div className="settings-heading">
          <div>
            <span className="eyebrow">PREFERENCES</span>
            <h2 id="settings-title">STELLA settings</h2>
          </div>

          <button
            type="button"
            className="settings-close"
            onClick={onClose}
            aria-label="Close settings"
          >
            ×
          </button>
        </div>

        <label className="setting-row">
          <span>Ambient motion</span>
          <input type="checkbox" defaultChecked />
        </label>

        <label className="setting-row">
          <span>Voice responses</span>
          <input type="checkbox" defaultChecked />
        </label>

        <label className="setting-row">
          <span>Auto-sleep after inactivity</span>
          <input type="checkbox" />
        </label>

        <div className="settings-note">
          Local desktop session · v0.8.4
        </div>

      </section>
    </div>
  );
}
