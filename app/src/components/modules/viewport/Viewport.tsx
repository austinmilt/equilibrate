import { PublicKey } from "@solana/web3.js";
import { RefObject, useCallback, useEffect, useRef, useState } from "react";
import { Stage, Layer, Text } from "react-konva";
import { ActiveGalaxyProvider } from "../../shared/galaxy/provider";
import { Hud } from "../hud/Hud";
import { Galaxy } from "./Galaxy";
import "./Viewport.css";

interface Props {
    gameAddress: PublicKey | undefined;
}

export function Viewport(props: Props): JSX.Element {
    const viewportRef = useRef<HTMLElement>(null);
    const [width, height] = useViewportDimenions(viewportRef);

    return (
        <section className="viewport" ref={viewportRef}>
            <ActiveGalaxyProvider>
                <Hud />
                <Stage
                    className="stage"
                    width={width}
                    height={height}
                >
                    <Layer>
                        {
                            props.gameAddress === undefined ?
                                <ViewportSkeleton/> :
                                <ViewportDefined
                                    width={ width }
                                    height={ height }
                                />
                        }
                    </Layer>
                </Stage>
            </ActiveGalaxyProvider>
        </section>
    );
}



function ViewportSkeleton(): JSX.Element {
    return <Text text="Select a game"/>;
}


interface ViewportDefinedProps {
    width: number;
    height: number;
}


function ViewportDefined(props: ViewportDefinedProps): JSX.Element {
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
