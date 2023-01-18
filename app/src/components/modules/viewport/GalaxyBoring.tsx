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


    const drawBar: (bar: Rect, isPlayer: boolean) => void = useCallback((bar, isPlayer) => {
        const canvas: HTMLCanvasElement | null = canvasRef.current;
        const context: CanvasRenderingContext2D | null = canvas?.getContext("2d") ?? null;
        if ((canvas == null) || (context == null)) return;

        if (bar.height > 0) {
            // draw the bar
            context.fillStyle = isPlayer ? InlineStyles.GLOBAL.colorMoney : InlineStyles.GLOBAL.colorCooling;
            context.fillRect(bar.left, bar.top, bar.width, bar.height);

            // draw dividing line between it and other bars
            context.strokeStyle = InlineStyles.GLOBAL.colorPrimaryDarkest;
            context.lineWidth = 2;
            context.beginPath();
            context.moveTo(bar.left, bar.bottom);
            context.lineTo(bar.right, bar.bottom);
            context.stroke();
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
        let drewPlayerBar: boolean = false;
        for (const bar of barPropsContext.bars) {
            if ((bar.starIndex === activeGalaxyContext.playerStar.index) && !drewPlayerBar) {
                drawBar(bar.canvas, true);
                drewPlayerBar = true;
            } else {
                drawBar(bar.canvas, false);
            }
        }
    }, [barPropsContext.bars, activeGalaxyContext.playerStar.index]);


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
    starIndex: number;
}


interface UseComputedBarPropsContext {
    bars: BarProps[];
    system: {
        tokens: number;
    }
}


function useComputedBarProps(
    canvas: HTMLCanvasElement | null,
    activeGalaxyContext: ActiveGalaxyContextState
): UseComputedBarPropsContext {

    const systemTokens: number = useMemo(() => {
        return activeGalaxyContext.stars?.reduce((total, star) => star.fuel + total, 0) ?? 0;
    }, [activeGalaxyContext.stars]);

    const nBars: number = useMemo(() => activeGalaxyContext.stars?.length ?? 0, [activeGalaxyContext.stars]);

    const computeBarProps: (star: StarData, index: number) => BarProps[] = useCallback((star, index) => {
        if (canvas == null) return [emptyBar(star)];
        const barHeight: number = Math.round(canvas.height * (star.fuel / systemTokens));
        const nSections: number = index === 0 ? 1 : Math.max(1, star.satellites);
        const sectionHeight: number = Math.round(barHeight / nSections);
        const barTop: number = canvas.height - barHeight;

        const barBaseWidth: number = canvas.width / nBars;
        const barWidth: number = Math.round(InlineStyles.STAR_BAR.widthPropBase * barBaseWidth);
        // move the bar right some so it is centered in its section
        const barLeft: number = index * barBaseWidth + 0.5*(barBaseWidth - barWidth);

        const sections: BarProps[] = Array(nSections).fill(null).map((_, i) => {
            const sectionTop: number = barTop + sectionHeight*i;
            const rectCanvas: Rect = {
                left: barLeft,
                top: sectionTop,
                width: barWidth,
                height: sectionHeight,
                right: barLeft + barWidth,
                bottom: sectionTop + sectionHeight
            };
            return {
                canvas: rectCanvas,
                screen: transformCanvasRectToScreen(rectCanvas, canvas),
                star: star,
                starIndex: index
            };
        });

        return sections;
    }, [canvas, systemTokens, nBars]);


    const bars: BarProps[] = useMemo(() => {
        if ((canvas == null) || (activeGalaxyContext.stars == null)) return [];
        return activeGalaxyContext.stars.map(computeBarProps).flat();
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
        star: star,
        starIndex: -1
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
