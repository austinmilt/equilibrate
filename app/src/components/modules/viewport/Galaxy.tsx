import { useCallback, useMemo } from "react";
import { ActiveGalaxyContextState, GalaxyConstants, StarData, useActiveGalaxy } from "../../shared/galaxy/provider";
import { Star } from "./Star";

// Galaxy is the collection of stars and conduits
export interface GalaxyProps {
    viewportDimensions: {
        widthPixels: number;
        heightPixels: number;
    }
}


export function Galaxy(props: GalaxyProps): JSX.Element {
    const activeGalaxyContext: ActiveGalaxyContextState = useActiveGalaxy();
    const stars: StarProps[] = useComputedStarProps(
        props.viewportDimensions,
        activeGalaxyContext.stars ?? [],
        activeGalaxyContext.galaxy?.constants
    );

    const onStarMousedOverChange: (index: number, mousedOver: boolean) => void = useCallback((index, mousedOver) => {
        if (mousedOver) {
            activeGalaxyContext.focalStar.set(index);
        }
    }, [activeGalaxyContext.focalStar.set]);

    return <>
        {stars.map((star, i) =>
            <Star
                x={star.x}
                y={star.y}
                radius={star.radius}
                fuelChangeRate={star.fuelChangeRate}
                focused={activeGalaxyContext.focalStar.index === i}
                onClick={() => activeGalaxyContext.focalStar.onClick(i)}
                onMouseOverChange={(mousedOver: boolean) => onStarMousedOverChange(i, mousedOver)}
                key={i}
            />
        )}
    </>;
}


//TODO change to making a star field with a fixed grid with randomly chosen cells for each star to be centered in,
//TODO and the holding bucket to be central
function useComputedStarProps(
    viewportDimensions: GalaxyProps["viewportDimensions"],
    stars: StarData[],
    galaxyConstants: GalaxyConstants | undefined
): StarProps[] {
    const nPlayableStars: number = useMemo(() => stars.length - 1, [stars]);
    const innermostRingDivisions: number = useMemo(() => getInnerMostRingDivisions(nPlayableStars), [stars]);
    const numberOfRings: number = useMemo(() => computeNumberOfRings(
        nPlayableStars, innermostRingDivisions
    ), [nPlayableStars, innermostRingDivisions]);

    const boundarySize: number = useMemo(() => Math.min(
        viewportDimensions.heightPixels,
        viewportDimensions.widthPixels),
    [viewportDimensions]);

    const ringRadii: number[] = useMemo(() => Array(numberOfRings)
        .fill(null)
        .map((_, i) => computeRingRadius(i, boundarySize, numberOfRings)),
    [boundarySize, numberOfRings]);

    const ringDivisionArcLengths: number[] = useMemo(() =>
        Array(numberOfRings)
            .fill(null)
            .map((_, i) => computeRingDivisonArcLengthRadians(i, innermostRingDivisions, numberOfRings)),
    [innermostRingDivisions, numberOfRings]);

    const starMaxRadius: number = useMemo(() => computeStarMaxRadius(
        ringRadii[0],
        ringDivisionArcLengths[0]
    ), [ringRadii, ringDivisionArcLengths]);

    return useMemo(() => {
        const width: number = viewportDimensions.widthPixels;
        const height: number = viewportDimensions.heightPixels;
        const result: StarProps[] = [];
        // the central star (holding bucket)
        if (stars.length > 0) {
            result.push({
                x: Math.round(width/2),
                y: Math.round(height/2),
                radius: computeStarRadius(
                    stars[0].fuel,
                    starMaxRadius,
                    galaxyConstants?.entryFuel ?? 0,
                    galaxyConstants?.maxSatellites ?? 0
                ),
                fuelChangeRate: stars[0].fuelChangeRate
            });
        }
        //TODO this stuff should probably be delegated to the Star component
        let starOverallIndex: number = 1;
        for (let ringIndex = 0; ringIndex < numberOfRings; ringIndex++) {
            const ringDivisions: number = computeNumberOfRingDivisions(ringIndex, innermostRingDivisions);
            const reminaingStars: number = nPlayableStars - starOverallIndex + 1;
            const starsToPlaceInRing: number = Math.min(reminaingStars, ringDivisions);
            for (let starIndexInRing = 0; starIndexInRing < starsToPlaceInRing; starIndexInRing++) {
                const starStats: StarData = stars[starOverallIndex];
                const starRadius: number = computeStarRadius(
                    starStats.fuel,
                    starMaxRadius,
                    galaxyConstants?.entryFuel ?? 0,
                    galaxyConstants?.maxSatellites ?? 0
                );
                const { x, y } = computeStarCoordinates(
                    starIndexInRing,
                    starRadius,
                    ringDivisions,
                    ringRadii[ringIndex],
                    width,
                    height
                );
                result.push({
                    x: Math.round(x),
                    y: Math.round(y),
                    radius: starRadius,
                    fuelChangeRate: starStats.fuelChangeRate
                });
                starOverallIndex += 1;
            }
        }
        return result;
    }, [stars]);
}


function getInnerMostRingDivisions(stars: number): number {
    return Math.min(stars, 8);
}


function computeStarCoordinates(
    indexInRing: number,
    starRadius: number,
    ringDivisions: number,
    ringRadius: number,
    viewportWidth: number,
    viewportHeight: number
): { x: number, y: number } {
    const radiansPerDivision: number = Math.PI * 2 / ringDivisions;
    const radians: number = radiansPerDivision * indexInRing;
    const xCenter: number = viewportWidth / 2;
    const yCenter: number = viewportHeight / 2;
    return {
        x: Math.cos(radians) * (ringRadius - starRadius) + xCenter,
        y: Math.sin(radians) * (ringRadius - starRadius) + yCenter
    };
}


function computeNumberOfRings(stars: number, innermostRingDivisions: number): number {
    let starsCovered: number = innermostRingDivisions;
    let rings: number = 1;
    while (starsCovered < stars) {
        rings += 1;
        // each ring covers twice as many stars as the next innermost ring
        starsCovered += 2*rings*innermostRingDivisions;
    }
    return rings;
}


function computeRingRadius(ringIndex: number, viewportSize: number, numberOfRings: number): number {
    const outermostRingRadius: number = 0.5 * viewportSize;
    return outermostRingRadius / (numberOfRings - ringIndex);
}


function computeRingDivisonArcLengthRadians(
    ringIndex: number,
    innermostRingDivisions: number,
    numberOfRings: number
): number {
    const ringDivisions: number = innermostRingDivisions * (numberOfRings - ringIndex);
    return (2 * Math.PI) / ringDivisions;
}


function computeNumberOfRingDivisions(
    ringIndex: number,
    innermostRingDivisions: number,
): number {
    return innermostRingDivisions * (ringIndex + 1);
}


function computeStarRadius(
    fuel: number,
    maxRadius: number,
    entryFuel: number,
    maxSatellites: number
): number {
    const minPossibleFuel: number = 0;
    //  whenever someone enters or leaves (growing suns should always grow, not shrink, and vice versa)
    const maxPossibleFuel: number = entryFuel * maxSatellites;
    const relativeFuel: number = (
        (fuel - minPossibleFuel) / (maxPossibleFuel - minPossibleFuel)
    );

    const minRadius: number = 10;
    if (isNaN(relativeFuel)) {
        return minRadius;
    }

    return relativeFuel * (maxRadius - minRadius) + minRadius;
}


// eslint-disable-next-line max-len
// https://math.stackexchange.com/questions/1662616/calculate-the-diameter-of-an-inscribed-circle-inside-a-sector-of-circle
function computeStarMaxRadius(innermostRingRadius: number, innermostRingDivisionArcLengthRadians: number): number {
    const z: number = Math.sin(innermostRingDivisionArcLengthRadians / 2.0);
    return innermostRingRadius * (z / (1 + z));
}


interface StarProps {
    x: number;
    y: number;
    radius: number;
    fuelChangeRate: number;
}
