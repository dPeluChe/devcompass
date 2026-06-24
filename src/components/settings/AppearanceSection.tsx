import { uiPrefsStore } from '../../store/uiPrefs'

export function AppearanceSection() {
  const { fancyBg, toggleFancyBg } = uiPrefsStore()
  return (
    <section>
      <h2>Appearance</h2>
      <label className="toggle-row">
        <span className="toggle-label">
          Atmospheric background
          <span className="muted toggle-hint">Subtle gradient behind the app</span>
        </span>
        <button
          role="switch"
          aria-checked={fancyBg}
          className={`toggle-switch ${fancyBg ? 'on' : ''}`}
          onClick={toggleFancyBg}
        />
      </label>
    </section>
  )
}
