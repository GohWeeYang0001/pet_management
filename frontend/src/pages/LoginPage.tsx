import { useState, type FormEvent } from "react";
import { login } from "../services/authService";
import { ApiError } from "../services/api";
import type { AuthUser } from "../types/auth";

export default function LoginPage({ onLogin, notice }: { onLogin: (user: AuthUser) => void; notice: string }) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (submitting) return;
        if (!username.trim() || !password) { setError("Enter your username and password."); return; }
        setSubmitting(true); setError("");
        try { const user = await login(username.trim(), password); setPassword(""); onLogin(user); }
        catch (failure) {
            setPassword("");
            setError(failure instanceof ApiError && failure.status === 401 ? "Invalid username or password." :
                failure instanceof ApiError && failure.status === 429 ? "Too many login attempts. Please try again later." :
                "Unable to log in. Check your connection and try again.");
        } finally { setSubmitting(false); }
    }
    return <main className="login-page">
        <header><p className="page-eyebrow">Pet Management</p><h1 className="page-title">Welcome back</h1><p className="form-hint">Log in to manage your business.</p></header>
        <form className="sheet-form login-card" onSubmit={submit}>
            <label>Username<input name="username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} maxLength={100} required disabled={submitting} autoFocus /></label>
            <label>Password<input name="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={submitting} /></label>
            {notice && !error && <p className="form-hint" role="status">{notice}</p>}
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="primary-button" type="submit" disabled={submitting}>{submitting ? "Logging in..." : "Login"}</button>
        </form>
    </main>;
}
