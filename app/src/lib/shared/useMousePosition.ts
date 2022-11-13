import { useEffect, useState } from "react";

export function useMousePosition(): [number, number] {
    const [x, setX] = useState<number>(0);
    const [y, setY] = useState<number>(0);

    useEffect(() => {
        function updatePosition(event: MouseEvent): void {
            setX(event.pageX);
            setY(event.pageY);
        }

        addEventListener("mousemove", updatePosition);

        return () => removeEventListener("mousemove", updatePosition);
    });

    return [x, y];
}
