import { useState } from "react";
import RevenuePage from "./RevenuePage";
import ExpensesPage from "./ExpensesPage";
import InventoryPage from "./InventoryPage";
import ServicesPage from "./ServicesPage";
import type { AuthUser } from "../types/auth";
import { roleLabels } from "../utils/displayLabels";

type Section = "revenue" | "expenses" | "inventory" | "services";
const sections: Array<{ key: Section; label: string; description: string }> = [
    { key: "revenue", label: "营业额", description: "查看每月经营状况" },
    { key: "expenses", label: "支出", description: "记录业务支出" },
    { key: "inventory", label: "库存", description: "管理物品及库存不足提醒" },
    { key: "services", label: "服务管理", description: "管理宠物美容服务" },
];

export default function MorePage({ user, onLogout }: { user: AuthUser; onLogout: () => Promise<void> }) {
    const [section, setSection] = useState<Section | null>(null);
    const [loggingOut, setLoggingOut] = useState(false);
    const [logoutError, setLogoutError] = useState("");
    async function signOut() {
        setLoggingOut(true); setLogoutError("");
        try { await onLogout(); }
        catch { setLogoutError("无法退出登录，请重试。"); }
        finally { setLoggingOut(false); }
    }
    const title = sections.find((item) => item.key === section)?.label ?? "更多";
    return <>
        <header className="page-header">
            {section && <button className="back-button" type="button" onClick={() => setSection(null)}>‹ 返回更多</button>}
            <p className="page-eyebrow">宠物管理</p><h1 className="page-title">{title}</h1>
        </header>
        {section === "revenue" && <RevenuePage />}
        {section === "expenses" && <ExpensesPage />}
        {section === "inventory" && <InventoryPage />}
        {section === "services" && <ServicesPage />}
        {!section && <main className="business-page"><div className="business-list">
            {sections.map((item) => <button className="business-row" type="button" key={item.key} onClick={() => setSection(item.key)}>
                <span><strong>{item.label}</strong><small>{item.description}</small></span><span aria-hidden="true">›</span>
            </button>)}
        </div><section className="account-card" aria-label="账户">
            <p><strong>{user.username}</strong></p><p className="form-hint">{roleLabels[user.role]}</p>
            {logoutError && <p className="form-error" role="alert">{logoutError}</p>}
            <button className="secondary-button" type="button" onClick={signOut} disabled={loggingOut}>{loggingOut ? "正在退出..." : "退出登录"}</button>
        </section></main>}
    </>;
}
