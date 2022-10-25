import { useCallback, useMemo } from "react";
import { Star } from "./Star";

// Galaxy is the collection of stars and conduits
export interface GalaxyProps {
    /**
     * Stats about stars. Should include the central star.
     */
    stars: {
        fuel: number; // equivalent to bucket balance
        satellites: number; // equivalent to number of players,
        fuelChangeRate: number; // equivalent to bucket flow rate
    }[];

    galaxyConstants: {
        entryFuel: number;
        maxSatellites: number;
    }

    viewportDimensions: {
        widthPixels: number;
        heightPixels: number;
    }
}

//TODO 3) display info about a star
export function Galaxy(props: GalaxyProps): JSX.Element {
    const stars = useComputedStarProps(props);

    const onClickStar: DisplayProps["onClick"] = useCallback((starIndex) => {
        //TODO map to something meaningful, like changing buckets or showing stats
        console.log(stars[starIndex].flow);
    }, [stars]);

    return <Display stars={stars} onClick={onClickStar} />;
}


function useComputedStarProps(props: GalaxyProps): StarProps[] {
    const nPlayableStars: number = useMemo(() => props.stars.length - 1, [props.stars]);
    const innermostRingDivisions: number = useMemo(() => getInnerMostRingDivisions(nPlayableStars), [props.stars]);
    const numberOfRings: number = useMemo(() => computeNumberOfRings(
        nPlayableStars, innermostRingDivisions
    ), [nPlayableStars, innermostRingDivisions]);

    const boundarySize: number = useMemo(() => Math.min(
        props.viewportDimensions.heightPixels,
        props.viewportDimensions.widthPixels),
    [props.viewportDimensions]);

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
        const width: number = props.viewportDimensions.widthPixels;
        const height: number = props.viewportDimensions.heightPixels;
        const result: StarProps[] = [];
        // the central star (holding bucket)
        result.push({
            x: Math.round(width/2),
            y: Math.round(height/2),
            radius: computeStarRadius(
                props.stars[0].fuel,
                props.stars,
                starMaxRadius,
                props.galaxyConstants.entryFuel,
                props.galaxyConstants.maxSatellites
            ),
            flow: props.stars[0].fuelChangeRate
        });
        //TODO this stuff should probably be delegated to the Star component
        let starOverallIndex: number = 1;
        for (let ringIndex = 0; ringIndex < numberOfRings; ringIndex++) {
            const ringDivisions: number = computeNumberOfRingDivisions(ringIndex, innermostRingDivisions);
            const reminaingStars: number = nPlayableStars - starOverallIndex + 1;
            const starsToPlaceInRing: number = Math.min(reminaingStars, ringDivisions);
            for (let starIndexInRing = 0; starIndexInRing < starsToPlaceInRing; starIndexInRing++) {
                const starStats: GalaxyProps["stars"][0] = props.stars[starOverallIndex];
                const starRadius: number = computeStarRadius(
                    starStats.fuel,
                    props.stars,
                    starMaxRadius,
                    props.galaxyConstants.entryFuel,
                    props.galaxyConstants.maxSatellites
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
                    //TODO map the flow rate to something meaningful for display
                    flow: starStats.fuelChangeRate
                });
                starOverallIndex += 1;
            }
        }
        return result;
    }, [props.stars]);
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
    starStats: GalaxyProps["stars"],
    maxRadius: number,
    entryFuel: number,
    maxSatellites: number
): number {
    const minPossibleFuel: number = 0;
    //TODO change this to be entryFee*maxPlayers so the max is static per game and suns dont try to readjust
    //  whenever someone enters or leaves (growing suns should always grow, not shring, and vice versa)
    const maxPossibleFuel: number = entryFuel * maxSatellites;
    // const maxPossibleFuel: number = starStats.reduce((partialSum, s) => partialSum + s.fuel, 0);
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
    flow: number;
}

interface DisplayProps {
    stars: StarProps[];
    onClick: (index: number) => void;
}

function Display(props: DisplayProps): JSX.Element {
    return <>
        {props.stars.map((star, i) =>
            <Star
                x={star.x}
                y={star.y}
                radius={star.radius}
                flow={star.flow}
                key={i}
                onClick={() => props.onClick(i)}
            />
        )}
    </>;
}
