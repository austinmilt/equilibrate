import { useEffect } from "react";

export function useOnEscape(onKeyPressed: () => void): void {
    useEffect(() => {
        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onKeyPressed();
            }
        };
        addEventListener("keydown", handleEsc);

        return () => {
            removeEventListener("keydown", handleEsc);
        };
    }, []);
}
