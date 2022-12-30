import { useCallback, useMemo, useRef } from "react";
import { ActiveGalaxyContextState, useActiveGalaxy } from "../../shared/galaxy/provider";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    InteractionItem,
    ChartEvent,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { formatTokensShort } from "../../../lib/shared/number";

//TODO update language
//TODO update tutorial
//TODO fit chart to window


ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);

export interface GalaxyProps {
    viewportDimensions: {
        widthPixels: number;
        heightPixels: number;
    }
}


export function Galaxy(): JSX.Element {
    const activeGalaxyContext: ActiveGalaxyContextState = useActiveGalaxy();
    const chartRef = useRef<ChartJS>(null);

    const labels: string[] = useMemo(() => (
        activeGalaxyContext.stars?.map((_, i) => i === 0 ? "Wormhole" : `Star ${i}`) ?? []
    ), [activeGalaxyContext.stars]);

    const datasets = [
        {
            label: "Your share",
            data: activeGalaxyContext.stars?.map((s, i) => {
                if (activeGalaxyContext.playerStar.index === i) {
                    return s.fuel * (1 / s.satellites);

                } else {
                    return 0;
                }
            }),
            backgroundColor: "#D9594C",
            hoverBackgroundColor: "#D9594C",
            hoverBorderColor: "#e6e6e6",
            hoverBorderWidth: 2
        },
        {
            label: "Remaining share",
            data: activeGalaxyContext.stars?.map((s, i) => {
                if ((i == 0) || (s.satellites === 0) || (activeGalaxyContext.playerStar.index !== i)) {
                    return s.fuel;
                } else if (activeGalaxyContext.playerStar.index === i) {
                    return s.fuel * ((s.satellites - 1) / s.satellites);
                }
            }),
            backgroundColor: "#757575",
            hoverBackgroundColor: "#757575",
            hoverBorderColor: "#e6e6e6",
            hoverBorderWidth: 2
        },
    ];

    const data = {
        labels: labels,
        datasets: datasets
    };

    const getFocalStar = useCallback((event: ChartEvent): number | null => {
        let starIndex: number | null = null;
        if (chartRef.current != null && event.native != null) {
            const activeBars: InteractionItem[] = chartRef.current.getElementsAtEventForMode(
                event.native,
                "y",
                { intersect: false },
                false
            );
            if (activeBars.length > 0) {
                starIndex = activeBars[0].index;
            }
        }


        if (event.native?.target != null) {
            if (starIndex != null) {
                // @ts-ignore style is a known property
                event.native.target.style.cursor = "pointer";

            } else {
                // @ts-ignore style is a known property
                event.native.target.style.cursor = "default";
            }
        }
        return starIndex;
    }, [chartRef]);


    const onClick = useCallback((event: ChartEvent) => {
        const starIndex: number | null = getFocalStar(event);

        if (starIndex != null) {
            activeGalaxyContext.focalStar.onClick(starIndex);
        }
    }, [chartRef, activeGalaxyContext.focalStar.onClick]);


    const onChartMouseMove = useCallback((event: ChartEvent) => {
        const starIndex: number | null = getFocalStar(event);

        const mousedOver: boolean = activeGalaxyContext.focalStar.index === starIndex;
        activeGalaxyContext.focalStar.onHoverChange(mousedOver);
        if (starIndex != null) {
            activeGalaxyContext.focalStar.set(starIndex);
        }
    }, [activeGalaxyContext.focalStar.set, activeGalaxyContext.focalStar.onHoverChange]);


    const options = useMemo(() => ({
        indexAxis: "y" as const,
        responsive: true,
        scales: {
            x: {
                stacked: true,
                ticks: {
                    callback: (amount: string | number) => formatTokensShort(Number.parseInt(`${amount}`))
                }
            },
            y: {
                stacked: true,
            },
        },
        interaction: {
            mode: "y" as const,
            axis: "y" as const,
            intersect: false
        },
        onHover: onChartMouseMove,
        onClick: onClick
    }), [onClick, onChartMouseMove]);

    return <Bar
        ref={chartRef}
        options={options}
        data={data}
    />;
}
