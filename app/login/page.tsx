"use client";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_code: code.trim(), password }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.message ?? "ورود ناموفق بود.");
        setLoading(false);
        return;
      }
      window.location.href = "/dashboard";
    } catch {
      setError("ارتباط با سامانه برقرار نشد. دوباره تلاش کنید.");
      setLoading(false);
    }
  }

  return (
    <main className="auth">
      <form className="card" onSubmit={submit}>
        <div className="brand">راهبرد شوشتر</div>
        <h1>خوش آمدید</h1>
        <p>برای ورود امن به سامانه راهبرد شوشتر، مشخصات حساب خود را وارد کنید.</p>
        <label>
          کد کاربری
          <input value={code} onChange={(e) => setCode(e.target.value)} autoComplete="username" placeholder="کد کاربری خود را وارد کنید" required />
        </label>
        <label>
          رمز عبور
          <span style={{ position: "relative", display: "block", marginTop: 7 }}>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="رمز عبور خود را وارد کنید"
              required
              style={{ width: "100%", boxSizing: "border-box" }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? "پنهان کردن رمز عبور" : "نمایش رمز عبور"}
              aria-pressed={showPassword}
              title={showPassword ? "پنهان کردن رمز" : "نمایش رمز"}
              style={{ position: "absolute", left: -29, top: "50%", transform: "translateY(-50%)", width: 23, height: 23, minWidth: 23, minHeight: 23, padding: 0, margin: 0, display: "grid", placeItems: "center", borderRadius: 7, background: "rgba(22,157,204,.12)", border: "1px solid rgba(53,200,241,.3)", color: "inherit", boxShadow: "none", cursor: "pointer" }}
            >
              {showPassword ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M3 3l18 18M10.6 10.7a2 2 0 002.7 2.7M9.9 5.2A10.8 10.8 0 0112 5c5.2 0 8.8 4.2 10 7-.4 1-1.2 2.2-2.4 3.3M6.2 6.3C3.8 7.8 2.5 10 2 12c1.2 2.8 4.8 7 10 7 1.4 0 2.7-.3 3.8-.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/>
                </svg>
              )}
            </button>
          </span>
        </label>
        {error && <div className="error">{error}</div>}
        <button className="button" disabled={loading}>
          {loading ? "در حال احراز هویت…" : "ورود امن به سامانه"}
        </button>
      </form>
    </main>
  );
}
