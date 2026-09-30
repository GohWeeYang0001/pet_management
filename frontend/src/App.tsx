import { lazy, Suspense, useEffect, useState } from "react";

import BottomNavigation from "./components/layout/BottomNavigation";
import MobileLayout from "./components/layout/MobileLayout";
import LoginPage from "./pages/LoginPage";
import { getCurrentUser, logout } from "./services/authService";
import { SESSION_EXPIRED_EVENT } from "./services/api";
import type { AuthUser } from "./types/auth";

export type NavigationTab = "calendar" | "customers" | "more";
const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const CustomersPage = lazy(() => import("./pages/CustomersPage"));
const MorePage = lazy(() => import("./pages/MorePage"));

function App() {
    const [activeTab, setActiveTab] = useState<NavigationTab>("calendar");
    const [user, setUser] = useState<AuthUser | null>(null);
    const [checking, setChecking] = useState(true);
    const [startupError, setStartupError] = useState("");
    const [notice, setNotice] = useState("");

    async function checkSession() {
        setChecking(true); setStartupError("");
        try { setUser(await getCurrentUser()); }
        catch { setStartupError("Unable to connect. Please check your connection and try again."); }
        finally { setChecking(false); }
    }

    useEffect(() => {
        let current = true;
        getCurrentUser().then((authenticatedUser) => { if (current) setUser(authenticatedUser); })
            .catch(() => { if (current) setStartupError("Unable to connect. Please check your connection and try again."); })
            .finally(() => { if (current) setChecking(false); });
        return () => { current = false; };
    }, []);
    useEffect(() => {
        function expired() {
            setUser(null); setActiveTab("calendar");
            setNotice("Your session has expired. Please log in again.");
        }
        window.addEventListener(SESSION_EXPIRED_EVENT, expired);
        return () => window.removeEventListener(SESSION_EXPIRED_EVENT, expired);
    }, []);

    async function handleLogout() {
        await logout();
        setUser(null); setActiveTab("calendar"); setNotice("");
    }

    if (checking || startupError || !user) return <div className="mobile-app">
        {checking ? <div className="auth-state" role="status">Checking your session...</div> :
            startupError ? <div className="auth-state"><p className="form-error" role="alert">{startupError}</p><button className="primary-button" type="button" onClick={checkSession}>Retry</button></div> :
                <LoginPage notice={notice} onLogin={(authenticatedUser) => { setUser(authenticatedUser); setNotice(""); }} />}
    </div>;

    const page = {
        calendar: <CalendarPage />,
        customers: <CustomersPage />,
        more: <MorePage user={user} onLogout={handleLogout} />,
    }[activeTab];

    return (
        <MobileLayout
            navigation={
                <BottomNavigation
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                />
            }
        >
            <Suspense fallback={<div className="calendar-state" role="status">Loading...</div>}>{page}</Suspense>
        </MobileLayout>
    );
}

export default App;
