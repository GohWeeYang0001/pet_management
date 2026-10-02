import type { NavigationTab } from "../../App";

interface BottomNavigationProps {
    activeTab: NavigationTab;
    onTabChange: (tab: NavigationTab) => void;
}

const items: Array<{ id: NavigationTab; label: string; icon: "calendar" | "users" | "more" }> = [
    { id: "calendar", label: "日历", icon: "calendar" },
    { id: "customers", label: "客户", icon: "users" },
    { id: "more", label: "更多", icon: "more" },
];

function NavigationIcon({ name }: { name: "calendar" | "users" | "more" }) {
    if (name === "calendar") {
        return (
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M16 3v4M8 3v4M3 10h18" />
            </svg>
        );
    }

    if (name === "users") {
        return (
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
        );
    }

    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5" cy="12" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="19" cy="12" r="2" />
        </svg>
    );
}

function BottomNavigation({ activeTab, onTabChange }: BottomNavigationProps) {
    return (
        <nav className="bottom-navigation" aria-label="主导航">
            {items.map((item) => (
                <button
                    className={`nav-item${activeTab === item.id ? " active" : ""}`}
                    key={item.id}
                    type="button"
                    aria-current={activeTab === item.id ? "page" : undefined}
                    onClick={() => onTabChange(item.id)}
                >
                    <NavigationIcon name={item.icon} />
                    <span>{item.label}</span>
                </button>
            ))}
        </nav>
    );
}

export default BottomNavigation;
