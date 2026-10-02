import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { login } from "../../services/authService";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError("Enter your username and password.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      navigate(location.state?.from || "/my-dtr", { replace: true });
    } catch (err) {
      setError(
        err.status === 429
          ? "Too many attempts. Please wait a minute and try again."
          : err.message || "Sign-in failed.",
      );
    } finally {
      setLoading(false);
    }
  };

  const field = {
    width: "100%", padding: "10px 12px", border: "1px solid #cbd5e1",
    borderRadius: 8, fontSize: 14, marginTop: 6,
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "64px 16px" }}>
      <form
        onSubmit={submit}
        style={{
          width: "100%", maxWidth: 380, background: "white", borderRadius: 12,
          padding: 28, boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
        }}
      >
        <h2 style={{ marginBottom: 4, color: "#0f172a" }}>Staff Sign In</h2>
        <p style={{ marginBottom: 20, color: "#64748b", fontSize: 13 }}>
          Sign in to view your DTR or use HR tools. Time In/Out does not need a sign-in.
        </p>

        <label style={{ fontSize: 13, color: "#334155" }}>
          Username
          <input
            style={field}
            value={username}
            autoComplete="username"
            onChange={(e) => setUsername(e.target.value.toUpperCase())}
          />
        </label>

        <label style={{ fontSize: 13, color: "#334155", display: "block", marginTop: 14 }}>
          Password
          <input
            style={field}
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && (
          <div role="alert" style={{ marginTop: 14, color: "#dc2626", fontSize: 13 }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: 20, width: "100%", padding: "11px 0", border: 0, borderRadius: 8,
            background: loading ? "#7dd3fc" : "#0ea5e9", color: "white", fontWeight: 600,
            cursor: loading ? "default" : "pointer",
          }}
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
