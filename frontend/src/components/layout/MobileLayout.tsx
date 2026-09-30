import type { ReactNode } from "react";

interface MobileLayoutProps {
    children: ReactNode;
    navigation: ReactNode;
}

function MobileLayout({ children, navigation }: MobileLayoutProps) {
    return (
        <div className="mobile-app">
            <main className="app-content">{children}</main>
            {navigation}
        </div>
    );
}

export default MobileLayout;
