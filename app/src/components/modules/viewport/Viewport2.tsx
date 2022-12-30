import { RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActiveGalaxyProvider } from "../../shared/galaxy/provider";
import { useActiveGame } from "../../shared/game/provider";
import { Galaxy } from "./Galaxy2";
import styles from "./styles.module.css";
import { InlineStyles } from "../../shared/inline-styles";
import { Hud } from "../hud/Hud";

export function Viewport(): JSX.Element {
    const { address: gameAddress } = useActiveGame();
    const viewportRef = useRef<HTMLElement>(null);
    const [viewportWidth, viewportHeight] = useElementDimensions(viewportRef);
    const stageWidth: number = useMemo(() => viewportWidth, [viewportWidth]);
    const stageHeight: number = useMemo(() => InlineStyles.STAGE.heightPropViewport*viewportHeight, [viewportHeight]);

    return (
        <section className={styles["viewport"]} ref={viewportRef}>
            <ActiveGalaxyProvider>
                <Hud/>
                <Galaxy/>
            </ActiveGalaxyProvider>
        </section>
    );
}


interface ScreenDimensions {
    width: number;
    height: number;
}



// function ViewportSkeleton(props: ScreenDimensions): JSX.Element {
//     const [ref, setRef] = useState<Konva.Text | null>(null);
//     const [x, setX] = useState<number>(0);
//     const [y, setY] = useState<number>(0);

//     const updateTextDimensions: () => void = useCallback(() => {
//         if (ref !== null) {
//             setX((props.width - ref.width()) / 2);
//             setY((props.height - ref.height()) / 2);
//         }
//     }, [ref, props.width, props.height]);

//     useEffect(() => {
//         updateTextDimensions();
//     }, [updateTextDimensions]);

//     return (
//         <Text
//             ref={setRef}
//             text={((x > 0) && (y > 0)) ? "Select or create a game" : ""}
//             x={x}
//             y={y}
//             fill={InlineStyles.GLOBAL.colorTextBase}
//             fontSize={30}
//             align="center"
//             width={ props.width / 2 }
//         />
//     );
// }


// function ViewportDefined(props: ScreenDimensions): JSX.Element {
//     return (
//         <Galaxy
//             viewportDimensions={{widthPixels: props.width, heightPixels: props.height}}
//         />
//     );
// }


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
