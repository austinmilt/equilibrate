import { useCallback, useEffect, useMemo, useRef } from "react";
import { ActiveGalaxyContextState, StarData, useActiveGalaxy } from "../../shared/galaxy/provider";
import styles from "./styles.module.css";
import { InlineStyles } from "../../shared/inline-styles";


interface Props {
    viewportDimensions: {
        widthPixels: number;
        heightPixels: number;
    }
}


export function GalaxyBoring(props: Props): JSX.Element {
    const activeGalaxyContext: ActiveGalaxyContextState = useActiveGalaxy();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const barPropsContext = useComputedBarProps(canvasRef.current, activeGalaxyContext);

    // Set the canvas resolution for this screen
    // eslint-disable-next-line max-len
    // https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas#scaling_for_high_resolution_displays
    useEffect(() => {
        const canvas: HTMLCanvasElement | null = canvasRef.current;
        if (canvas == null) return;

        canvas.width = props.viewportDimensions.widthPixels;
        canvas.height = props.viewportDimensions.heightPixels;

        // dont need to scale the context because we draw relative to the
        // canvas size

        canvas.style.width = `${props.viewportDimensions.widthPixels}px`;
        canvas.style.height = `${props.viewportDimensions.heightPixels}px`;

        // clear everything so we dont wind up with weird pixels left over
        // in case the window is adjusted in an unexpected way
        const context: CanvasRenderingContext2D | null = canvas.getContext("2d");
        if (context != null) {
            context.clearRect(0, 0, canvas.width, canvas.height);
        }
    }, [canvasRef.current, props.viewportDimensions]);


    const drawBar: (bar: Rect) => void = useCallback((bar) => {
        const canvas: HTMLCanvasElement | null = canvasRef.current;
        const context: CanvasRenderingContext2D | null = canvas?.getContext("2d") ?? null;
        if ((canvas == null) || (context == null)) return;

        if (bar.width > 0) {
            context.fillStyle = InlineStyles.GLOBAL.colorMoney;
            context.fillRect(bar.left, bar.top, bar.width, bar.height);
        }
    }, [canvasRef.current]);


    const clearCanvas: () => void = useCallback(() => {
        const canvas: HTMLCanvasElement | null = canvasRef.current;
        const context: CanvasRenderingContext2D | null = canvas?.getContext("2d") ?? null;
        if ((canvas == null) || (context == null)) return;
        context.clearRect(0, 0, canvas.width, canvas.height);
    }, [canvasRef.current]);


    useEffect(() => {
        // sometimes clearing only the part of the canvas with the
        //  bar being updated on it can be faulty, and we're redrawing
        //  most of the canvas on every render anyway, so  just clear the
        //  whole thing on every render
        clearCanvas();
        barPropsContext.bars.map(bar => drawBar(bar.canvas));
    }, [barPropsContext.bars]);


    return (
        <canvas ref={canvasRef} className={styles["stage"]}>
            Canvas is required to use this app.
        </canvas>
    );
}


interface Rect {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
}


interface BarProps {
    canvas: Rect;
    screen: Rect;
    star: StarData;
}


interface UseComputedBarPropsContext {
    bars: BarProps[];
    system: {
        tokens: number;
    }
}


//TODO make a bar/rect for each player so you can see the divisions
//TODO in the bar and then color the player bar differently above
function useComputedBarProps(
    canvas: HTMLCanvasElement | null,
    activeGalaxyContext: ActiveGalaxyContextState
): UseComputedBarPropsContext {

    const systemTokens: number = useMemo(() => {
        return activeGalaxyContext.stars?.reduce((total, star) => star.fuel + total, 0) ?? 0;
    }, [activeGalaxyContext.stars]);

    const nBars: number = useMemo(() => activeGalaxyContext.stars?.length ?? 0, [activeGalaxyContext.stars]);

    const computeBarProps: (star: StarData, index: number) => BarProps = useCallback((star, index) => {
        if (canvas == null) return emptyBar(star);
        const barHeight: number = Math.round(canvas.height * (star.fuel / systemTokens));
        const barTop: number = canvas.height - barHeight;

        const barBaseWidth: number = canvas.width / nBars;
        const barWidth: number = Math.round(InlineStyles.STAR_BAR.widthPropBase * barBaseWidth);
        // move the bar right some so it is centered in its section
        const barLeft: number = index * barBaseWidth + 0.5*(barBaseWidth - barWidth);

        const rectCanvas: Rect = {
            left: barLeft,
            top: barTop,
            width: barWidth,
            height: barHeight,
            right: barLeft + barWidth,
            bottom: barTop + barHeight
        };
        return {
            canvas: rectCanvas,
            screen: transformCanvasRectToScreen(rectCanvas, canvas),
            star: star
        };
    }, [canvas, systemTokens, nBars]);


    const bars: BarProps[] = useMemo(() => {
        if ((canvas == null) || (activeGalaxyContext.stars == null)) return [];
        return activeGalaxyContext.stars.map(computeBarProps);
    }, [activeGalaxyContext.stars]);


    return {
        bars: bars,
        system: {
            tokens: systemTokens
        }
    };
}


function emptyBar(star: StarData): BarProps {
    const rectEmpty: Rect = {
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        width: 0,
        height: 0
    };
    return {
        canvas: rectEmpty,
        screen: rectEmpty,
        star: star
    };
}


function transformCanvasRectToScreen(barRect: Rect, canvas: HTMLCanvasElement): Rect {
    const canvasRect: DOMRect = canvas.getBoundingClientRect();
    return {
        left: barRect.left + canvasRect.left,
        top: barRect.top + canvasRect.top,
        width: barRect.width,
        height: barRect.height,
        right: barRect.right + canvasRect.right,
        bottom: barRect.bottom + canvasRect.bottom
    };
}
