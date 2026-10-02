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
        catch { setStartupError("无法连接，请检查网络后重试。"); }
        finally { setChecking(false); }
    }

    useEffect(() => {
        let current = true;
        getCurrentUser().then((authenticatedUser) => { if (current) setUser(authenticatedUser); })
            .catch(() => { if (current) setStartupError("无法连接，请检查网络后重试。"); })
            .finally(() => { if (current) setChecking(false); });
        return () => { current = false; };
    }, []);
    useEffect(() => {
        function expired() {
            setUser(null); setActiveTab("calendar");
            setNotice("登录已过期，请重新登录。");
        }
        window.addEventListener(SESSION_EXPIRED_EVENT, expired);
        return () => window.removeEventListener(SESSION_EXPIRED_EVENT, expired);
    }, []);

    async function handleLogout() {
        await logout();
        setUser(null); setActiveTab("calendar"); setNotice("");
    }

    if (checking || startupError || !user) return <div className="mobile-app">
        {checking ? <div className="auth-state" role="status">正在验证登录状态...</div> :
            startupError ? <div className="auth-state"><p className="form-error" role="alert">{startupError}</p><button className="primary-button" type="button" onClick={checkSession}>重试</button></div> :
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
            <Suspense fallback={<div className="calendar-state" role="status">加载中...</div>}>{page}</Suspense>
        </MobileLayout>
    );
}

export default App;
