import { useEffect, RefObject } from "react";

/**
 * Fires the callback if none of the provided elements are clicked on.
 *
 * @param elements
 * @param onClickOutside
 */
export function useOnClickOutside(elements: RefObject<HTMLElement>[], onClickOutside: () => void): void {

    // https://stackoverflow.com/a/42234988/3314063
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            const eventTarget: Node | null = event.target as Node;
            const clickedOnAny: boolean = elements.some(el => el.current?.contains(eventTarget));
            if (!clickedOnAny) {
                onClickOutside();
            }
        }
        addEventListener("mousedown", handleClickOutside);

        return () => {
            removeEventListener("mousedown", handleClickOutside);
        };
    }, [elements, onClickOutside]);
}
