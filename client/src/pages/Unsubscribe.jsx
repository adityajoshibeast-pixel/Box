import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api.js";

export default function Unsubscribe() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [status, setStatus] = useState(token ? "ready" : "invalid");

  const unsubscribe = async () => {
    setStatus("busy");
    try {
      await api.unsubscribe(token);
      try {
        localStorage.removeItem("resource-navigator-update-signup");
      } catch {
        // Unsubscribe succeeds even if browser storage is unavailable.
      }
      setStatus("done");
    } catch {
      setStatus("error");
    }
  };

  return (
    <main className="unsubscribe-page viewer-shell">
      <section className="unsubscribe-card">
        <span className="unsubscribe-mark" aria-hidden="true">✦</span>
        <h1>{status === "done" ? "You’re unsubscribed" : "Update preferences"}</h1>
        {status === "done" ? (
          <p>You won’t receive any more Resource Navigator update emails.</p>
        ) : status === "invalid" ? (
          <p>This unsubscribe link is not valid.</p>
        ) : (
          <p>Stop receiving emails when a new link, PDF, or image is added?</p>
        )}
        {status !== "done" && status !== "invalid" && (
          <button className="btn btn-primary" onClick={unsubscribe} disabled={status === "busy"}>
            {status === "busy" ? "Updating…" : status === "error" ? "Try again" : "Unsubscribe"}
          </button>
        )}
        <Link to="/">Back to Resource Navigator</Link>
      </section>
    </main>
  );
}
