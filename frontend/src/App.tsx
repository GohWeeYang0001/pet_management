import { useState } from "react";

import BottomNavigation from "./components/layout/BottomNavigation";
import MobileLayout from "./components/layout/MobileLayout";
import CalendarPage from "./pages/CalendarPage";
import CustomersPage from "./pages/CustomersPage";
import MorePage from "./pages/MorePage";

export type NavigationTab = "calendar" | "customers" | "more";

function App() {
    const [activeTab, setActiveTab] = useState<NavigationTab>("calendar");

    const page = {
        calendar: <CalendarPage />,
        customers: <CustomersPage />,
        more: <MorePage />,
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
            {page}
        </MobileLayout>
    );
}

export default App;
