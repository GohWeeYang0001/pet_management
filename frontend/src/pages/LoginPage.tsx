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
        if (!username.trim() || !password) { setError("请输入用户名和密码。"); return; }
        setSubmitting(true); setError("");
        try { const user = await login(username.trim(), password); setPassword(""); onLogin(user); }
        catch (failure) {
            setPassword("");
            setError(failure instanceof ApiError && failure.status === 401 ? "用户名或密码不正确。" :
                failure instanceof ApiError && failure.status === 429 ? "登录尝试过于频繁，请稍后重试。" :
                "无法登录，请检查网络连接后重试。");
        } finally { setSubmitting(false); }
    }
    return <main className="login-page">
        <header><p className="page-eyebrow">宠物管理</p><h1 className="page-title">欢迎回来</h1><p className="form-hint">登录以管理业务</p></header>
        <form className="sheet-form login-card" onSubmit={submit}>
            <label>用户名<input name="username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} maxLength={100} required disabled={submitting} autoFocus /></label>
            <label>密码<input name="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={submitting} /></label>
            {notice && !error && <p className="form-hint" role="status">{notice}</p>}
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="primary-button" type="submit" disabled={submitting}>{submitting ? "登录中..." : "登录"}</button>
        </form>
    </main>;
}
