"use client";

import AppShell from "@/app/components/AppShell";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const roleOptions = [
  ["section_manager", "مسئول بخش"],
  ["area_force", "نیروی حوزه"],
  ["area_manager", "مسئول مجازی حوزه"],
  ["battalion_commander", "فرمانده گردان"],
  ["deputy", "معاون"],
  ["main_admin", "مدیر اصلی"],
];

export default function NewUser() {
  const router = useRouter();
  const [areas, setAreas] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [roles, setRoles] = useState(roleOptions.slice(0, 4));
  const [form, setForm] = useState({
    user_code: "",
    display_name: "",
    password: "",
    role: "area_force",
    area_ids: [] as string[],
    group_ids: [] as string[],
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingPage, setLoadingPage] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [meResponse, areasResponse, groupsResponse] = await Promise.all([
          fetch("/api/me", { cache: "no-store" }),
          fetch("/api/areas", { cache: "no-store" }),
          fetch("/api/categories", { cache: "no-store" }),
        ]);
        const me = await meResponse.json();
        const areaData = await areasResponse.json();
        const groupData = groupsResponse.ok ? await groupsResponse.json() : { groups: [] };
        if (!meResponse.ok) throw new Error(me.message || "احراز هویت لازم است.");
        if (!areasResponse.ok) throw new Error(areaData.message || "دریافت حوزه‌ها انجام نشد.");
        if (!["main_admin", "deputy", "battalion_commander"].includes(me.profile?.role)) {
          throw new Error("شما مجاز به ایجاد کاربر نیستید.");
        }
        if (!active) return;
        const allowedRoles = me.profile.role === "main_admin" ? roleOptions : roleOptions.filter(([value]) => value !== "main_admin");
        setRoles(allowedRoles);
        setForm(current => ({ ...current, role: allowedRoles.some(([value]) => value === "area_force") ? "area_force" : allowedRoles[0][0] }));
        setAreas(areaData.areas ?? []);
        setGroups(groupData.groups ?? []);
      } catch (e: any) {
        if (active) setError(e.message || "بارگذاری صفحه انجام نشد.");
      } finally {
        if (active) setLoadingPage(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  function toggleArea(id: string) {
    setForm(current => ({
      ...current,
      area_ids: current.area_ids.includes(id)
        ? current.area_ids.filter(areaId => areaId !== id)
        : [...current.area_ids, id],
    }));
  }

  function toggleGroup(id: string) { setForm(current => ({ ...current, group_ids: current.group_ids.includes(id) ? current.group_ids.filter(x => x !== id) : [...current.group_ids, id] })); }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          user_code: form.user_code.trim(),
          display_name: form.display_name.trim(),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "ایجاد کاربر انجام نشد.");
      router.push("/users");
    } catch (e: any) {
      setError(e.message || "ایجاد کاربر انجام نشد.");
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <main className="shell unified-page">
        <div className="topbar">
          <div>
            <span className="eyebrow">راهبرد شوشتر</span>
            <h1>ایجاد کاربر</h1>
            <p>حساب کاربری، نقش و سطح دسترسی</p>
          </div>
        </div>
        {loadingPage ? (
          <section className="panel"><p>در حال دریافت اطلاعات…</p></section>
        ) : (
          <form className="form-panel" onSubmit={submit}>
            <label>
              کد کاربری
              <input
                value={form.user_code}
                onChange={event => setForm(current => ({ ...current, user_code: event.target.value }))}
                autoComplete="off"
                required
              />
              <small>فقط حروف انگلیسی، عدد، نقطه، خط تیره و زیرخط</small>
            </label>
            <label>
              نام و نام خانوادگی
              <input
                value={form.display_name}
                onChange={event => setForm(current => ({ ...current, display_name: event.target.value }))}
                required
              />
            </label>
            <label>
              رمز عبور
              <input
                type="password"
                minLength={8}
                value={form.password}
                onChange={event => setForm(current => ({ ...current, password: event.target.value }))}
                autoComplete="new-password"
                required
              />
              <small>حداقل ۸ کاراکتر</small>
            </label>
            <label>
              نقش
              <select
                value={form.role}
                onChange={event => setForm(current => ({ ...current, role: event.target.value, area_ids: event.target.value === "section_manager" ? [] : current.area_ids, group_ids: event.target.value === "section_manager" ? current.group_ids : [] }))}
              >
                {roles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            {form.role === "section_manager" ? <div className="area-access-list">
              <b>بخش‌های تحت مسئولیت</b><small>این کاربر مستقل از حوزه‌هاست و فقط گزارش‌های بخش‌های انتخاب‌شده را مشاهده می‌کند.</small>
              {groups.map(group => <label key={group.id}><input type="checkbox" checked={form.group_ids.includes(group.id)} onChange={() => toggleGroup(group.id)} /><span>{group.name}</span></label>)}
              {!groups.length && <p>بخشی برای تخصیص وجود ندارد.</p>}
            </div> : <div className="area-access-list">
              <b>حوزه‌های مجاز</b>
              <small>برای مدیران و معاونان نیز می‌توانید حوزه مشخص کنید؛ انتخاب حوزه برای نقش‌های حوزه‌ای ضروری است.</small>
              {areas.length ? areas.map(area => (
                <label key={area.id}>
                  <input
                    type="checkbox"
                    checked={form.area_ids.includes(area.id)}
                    onChange={() => toggleArea(area.id)}
                  />
                  <span>{area.name}</span>
                </label>
              )) : <p>حوزه فعالی برای تخصیص وجود ندارد.</p>}
            </div>}
            {error && <div className="error">{error}</div>}
            <button className="button" disabled={loading || !form.user_code.trim() || !form.display_name.trim() || form.password.length < 8}>
              {loading ? "در حال ایجاد…" : "ایجاد کاربر"}
            </button>
          </form>
        )}
      </main>
    </AppShell>
  );
}
