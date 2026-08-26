import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";

const STORAGE_KEY = "resource-navigator-update-signup";

export default function UpdateSignup() {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== "subscribed";
    } catch {
      return true;
    }
  });
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const dialogCloseRef = useRef(null);

  useEffect(() => {
    if (!confirmed) return undefined;
    dialogCloseRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") closeConfirmation();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirmed]);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api.subscribe(email, website);
      try {
        localStorage.setItem(STORAGE_KEY, "subscribed");
      } catch {
        // Private browsing may block storage; signup still succeeds.
      }
      setConfirmed(true);
      setEmail("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const closeConfirmation = () => {
    setConfirmed(false);
    setOpen(false);
  };

  return (
    <>
      <aside className={`update-signup ${open ? "is-open" : "is-collapsed"}`} aria-label="Latest update notifications">
        {open ? (
          <>
            <button className="update-signup-close" type="button" onClick={() => setOpen(false)} aria-label="Minimize update signup">
              ×
            </button>
            <div className="update-signup-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                <path d="M10 21h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <strong>Never miss what’s new</strong>
              <p>
                Want to receive the latest update when something new is added? We promise not to send useless messages—only updates.
              </p>
            </div>
            <form className="update-signup-form" onSubmit={submit}>
              <label className="sr-only" htmlFor="update-email">Email address</label>
              <input
                id="update-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="Enter your email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
              <input
                className="signup-honeypot"
                type="text"
                name="website"
                tabIndex="-1"
                autoComplete="off"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
                aria-hidden="true"
              />
              <button type="submit" disabled={busy}>{busy ? "Joining…" : "Notify me"}</button>
            </form>
            {error && <p className="update-signup-error" role="alert">{error}</p>}
          </>
        ) : (
          <button className="update-signup-pill" type="button" onClick={() => setOpen(true)}>
            <span aria-hidden="true">✦</span> Get update alerts
          </button>
        )}
      </aside>

      {confirmed && (
        <div className="signup-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeConfirmation()}>
          <section className="signup-modal" role="dialog" aria-modal="true" aria-labelledby="signup-confirmation-title">
            <div className="signup-modal-check" aria-hidden="true">✓</div>
            <h2 id="signup-confirmation-title">You’re on the list!</h2>
            <p>We’ll email you whenever a new link, PDF, or image is added. No noise—just useful updates with a direct link.</p>
            <button ref={dialogCloseRef} type="button" onClick={closeConfirmation}>Got it</button>
          </section>
        </div>
      )}
    </>
  );
}
