import { useEffect, useRef, type ReactNode } from "react";

interface BottomSheetProps {
    title: string;
    subtitle?: string;
    onClose: () => void;
    children: ReactNode;
}

function BottomSheet({ title, subtitle, onClose, children }: BottomSheetProps) {
    const dialogRef = useRef<HTMLElement>(null);

    useEffect(() => {
        // Keep initial focus inside the sheet without opening a native picker/keyboard.
        dialogRef.current?.focus({ preventScroll: true });
    }, []);

    useEffect(() => {
        const originalOverflow = document.body.style.overflow;

        document.body.style.overflow = "hidden";

        function closeOnEscape(event: KeyboardEvent) {
            if (event.key === "Escape") {
                onClose();
            }
        }

        window.addEventListener("keydown", closeOnEscape);

        return () => {
            document.body.style.overflow = originalOverflow;
            window.removeEventListener("keydown", closeOnEscape);
        };
    }, [onClose]);

    return (
        <div className="sheet-backdrop" onClick={(event) => {
            if (event.target === event.currentTarget) onClose();
        }} role="presentation">
            <section
                ref={dialogRef}
                tabIndex={-1}
                className="bottom-sheet"
                role="dialog"
                aria-modal="true"
                aria-labelledby="sheet-title"
            >
                <div className="sheet-handle" aria-hidden="true" />
                <header className="sheet-header">
                    <div>
                        <h2 id="sheet-title">{title}</h2>
                        {subtitle && <p className="sheet-subtitle">{subtitle}</p>}
                    </div>
                </header>
                {children}
            </section>
        </div>
    );
}

export default BottomSheet;
