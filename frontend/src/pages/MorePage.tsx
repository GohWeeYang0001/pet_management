import { useState } from "react";
import RevenuePage from "./RevenuePage";
import ExpensesPage from "./ExpensesPage";
import InventoryPage from "./InventoryPage";
import ServicesPage from "./ServicesPage";
import type { AuthUser } from "../types/auth";

type Section = "revenue" | "expenses" | "inventory" | "services";
const sections: Array<{ key: Section; label: string; description: string }> = [
    { key: "revenue", label: "Revenue", description: "View monthly business performance" },
    { key: "expenses", label: "Expenses", description: "Track business spending" },
    { key: "inventory", label: "Inventory", description: "Manage supplies and low stock" },
    { key: "services", label: "Services", description: "Manage grooming services" },
];

export default function MorePage({ user, onLogout }: { user: AuthUser; onLogout: () => Promise<void> }) {
    const [section, setSection] = useState<Section | null>(null);
    const [loggingOut, setLoggingOut] = useState(false);
    const [logoutError, setLogoutError] = useState("");
    async function signOut() {
        setLoggingOut(true); setLogoutError("");
        try { await onLogout(); }
        catch { setLogoutError("Could not log out. Please try again."); }
        finally { setLoggingOut(false); }
    }
    const title = sections.find((item) => item.key === section)?.label ?? "More";
    return <>
        <header className="page-header">
            {section && <button className="back-button" type="button" onClick={() => setSection(null)}>‹ Back to More</button>}
            <p className="page-eyebrow">Pet Management</p><h1 className="page-title">{title}</h1>
        </header>
        {section === "revenue" && <RevenuePage />}
        {section === "expenses" && <ExpensesPage />}
        {section === "inventory" && <InventoryPage />}
        {section === "services" && <ServicesPage />}
        {!section && <main className="business-page"><div className="business-list">
            {sections.map((item) => <button className="business-row" type="button" key={item.key} onClick={() => setSection(item.key)}>
                <span><strong>{item.label}</strong><small>{item.description}</small></span><span aria-hidden="true">›</span>
            </button>)}
        </div><section className="account-card" aria-label="Account">
            <p><strong>{user.username}</strong></p><p className="form-hint">{user.role === "ADMIN" ? "Admin" : "Employee"}</p>
            {logoutError && <p className="form-error" role="alert">{logoutError}</p>}
            <button className="secondary-button" type="button" onClick={signOut} disabled={loggingOut}>{loggingOut ? "Logging out..." : "Logout"}</button>
        </section></main>}
    </>;
}
