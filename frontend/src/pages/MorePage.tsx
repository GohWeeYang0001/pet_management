import { useState } from "react";
import RevenuePage from "./RevenuePage";
import ExpensesPage from "./ExpensesPage";
import InventoryPage from "./InventoryPage";
import ServicesPage from "./ServicesPage";

type Section = "revenue" | "expenses" | "inventory" | "services";
const sections: Array<{ key: Section; label: string; description: string }> = [
    { key: "revenue", label: "Revenue", description: "View monthly business performance" },
    { key: "expenses", label: "Expenses", description: "Track business spending" },
    { key: "inventory", label: "Inventory", description: "Manage supplies and low stock" },
    { key: "services", label: "Services", description: "Manage grooming services" },
];

export default function MorePage() {
    const [section, setSection] = useState<Section | null>(null);
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
        </div></main>}
    </>;
}
