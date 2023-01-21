import { ActiveGalaxyProvider } from "../../shared/providers/galaxy";
import { GalaxyBoring } from "./GalaxyBoring";
import styles from "./styles.module.css";
import { useRef, useMemo, RefObject, useState, useCallback, useEffect } from "react";
import { InlineStyles } from "../../shared/inline-styles";
import { HudBoring } from "../hud/HudBoring";

export function ViewportBoring(): JSX.Element {
    const viewportRef = useRef<HTMLElement>(null);
    const [viewportWidth, viewportHeight] = useElementDimensions(viewportRef);
    const stageWidth: number = useMemo(() => viewportWidth, [viewportWidth]);
    const stageHeight: number = useMemo(() => InlineStyles.STAGE.heightPropViewport*viewportHeight, [viewportHeight]);

    return (
        <section ref={viewportRef} className={styles["viewport"]}>
            <ActiveGalaxyProvider>
                <GalaxyBoring
                    viewportDimensions={{
                        widthPixels: stageWidth,
                        heightPixels: stageHeight
                    }}
                />
                <HudBoring/>
            </ActiveGalaxyProvider>
        </section>
    );
}


function useElementDimensions(element: RefObject<HTMLElement>): [number, number] {
    const [width, setWidth] = useState<number>(0);
    const [height, setHeight] = useState<number>(0);

    const updateDimensions: () => void = useCallback(() => {
        if (element.current != null) {
            const computedStyles = getComputedStyle(element.current);
            // parse the dimensions of the element from the CSS computed styles, stripping the "px" off
            // the end before parsing to a float. This eliminates padding.
            const widthPixelsString: string = computedStyles.width.slice(0, computedStyles.width.length - 2);
            const heightPixelsString: string = computedStyles.height.slice(0, computedStyles.height.length - 2);
            setWidth(Number.parseFloat(widthPixelsString));
            setHeight(Number.parseFloat(heightPixelsString));
        }
    }, [element.current]);

    useEffect(() => {
        addEventListener("resize", updateDimensions);
        addEventListener("load", updateDimensions);

        return () => {
            removeEventListener("resize", updateDimensions);
            addEventListener("load", updateDimensions);
        };
    }, []);

    useEffect(() => {
        updateDimensions();
    }, [element]);

    return [width, height];
}
