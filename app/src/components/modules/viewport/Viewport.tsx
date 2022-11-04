import { RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Text } from "react-konva";
import Konva from "konva";
import { ActiveGalaxyProvider } from "../../shared/galaxy/provider";
import { useActiveGame } from "../../shared/game/provider";
import { Hud } from "../hud/Hud";
import { Galaxy } from "./Galaxy";
import "./Viewport.css";

export function Viewport(): JSX.Element {
    const viewportRef = useRef<HTMLElement>(null);
    const [width, height] = useViewportDimenions(viewportRef);
    const { address: gameAddress } = useActiveGame();

    return (
        <section className="viewport" ref={viewportRef}>
            <ActiveGalaxyProvider>
                <Stage
                    className="stage"
                    width={width}
                    height={height}
                >
                    <Layer>
                        {
                            gameAddress === undefined ?
                                <ViewportSkeleton
                                    width={ width }
                                    height={ height }
                                /> :
                                <ViewportDefined
                                    width={ width }
                                    height={ height }
                                />
                        }
                    </Layer>
                </Stage>
                <Hud />
            </ActiveGalaxyProvider>
        </section>
    );
}


interface ViewportInnerProps {
    width: number;
    height: number;
}



function ViewportSkeleton(props: ViewportInnerProps): JSX.Element {
    const [ref, setRef] = useState<Konva.Text | null>(null);

    const x: number = useMemo(() => (props.width - (ref?.width() ?? 0)) / 2, [props.width, ref]);
    const y: number = useMemo(() => (props.height - (ref?.height() ?? 0)) / 2, [props.height, ref]);

    return (
        <Text
            ref={setRef}
            text="Select or create a game"
            x={x}
            y={y}
            fill="white"
            fontSize={30}
            align="center"
            width={props.width / 2}
        />
    );
}


function ViewportDefined(props: ViewportInnerProps): JSX.Element {
    return (
        <Galaxy
            viewportDimensions={{widthPixels: props.width, heightPixels: props.height}}
        />
    );
}


function useViewportDimenions(viewportRef: RefObject<HTMLElement>): [number, number] {
    const [width, setWidth] = useState<number>(0);
    const [height, setHeight] = useState<number>(0);

    const updateDimensions: () => void = useCallback(() => {
        if (viewportRef.current != null) {
            const computedStyles = getComputedStyle(viewportRef.current);
            // parse the dimensions of the viewport from the CSS computed styles, stripping the "px" off
            // the end before parsing to a float. This eliminates padding.
            const widthPixelsString: string = computedStyles.width.slice(0, computedStyles.width.length - 2);
            const heightPixelsString: string = computedStyles.height.slice(0, computedStyles.height.length - 2);
            setWidth(Number.parseFloat(widthPixelsString));
            setHeight(Number.parseFloat(heightPixelsString));
        }
    }, [viewportRef]);

    useEffect(() => {
        addEventListener("resize", updateDimensions);

        return () => {
            removeEventListener("resize", updateDimensions);
        };
    }, []);

    useEffect(() => {
        updateDimensions();
    }, [viewportRef]);

    return [width, height];
}
