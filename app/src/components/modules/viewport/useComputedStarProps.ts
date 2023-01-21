import { useMemo } from "react";
import { StarData, GalaxyConstants } from "../../shared/providers/galaxy";
import { GalaxyProps } from "./Galaxy";

export interface StarProps {
    x: number;
    y: number;
    radius: number;
    fuelChangeRate: number;
}


/**
 * Positions stars randomly across a grid.
 *
 * @param viewportDimensions
 * @param stars
 * @param galaxyConstants
 * @returns
 */
export function useComputedStarProps(
    viewportDimensions: GalaxyProps["viewportDimensions"],
    stars: StarData[],
    galaxyConstants: GalaxyConstants | undefined
): [StarProps[], number] {
    const [gridRows, gridCols] = useMemo(() => computeGridDimensions(
        stars.length,
        viewportDimensions.widthPixels,
        viewportDimensions.heightPixels
    ), [stars.length, viewportDimensions.widthPixels, viewportDimensions.heightPixels]);

    const starMaxRadius: number = useMemo(() => Math.min(
        viewportDimensions.widthPixels / gridCols,
        viewportDimensions.heightPixels / gridRows
    ), [viewportDimensions.widthPixels, gridRows, gridCols]);

    const activeCells: number[] = useMemo(() =>
        generatePlayableStarsActiveCells(stars.length, gridRows, gridCols),
    [stars.length, gridRows, gridCols]);

    const starCentroids: Point2D[] = useMemo(() => {
        const width: number = viewportDimensions.widthPixels;
        const height: number = viewportDimensions.heightPixels;
        const result: Point2D[] = [];
        // source star
        result.push({x: width / 2, y: height / 2});
        for (let i = 1; i < stars.length; i++) {
            result.push(
                computeStarCoordinates(
                    activeCells[i-1],
                    gridRows,
                    gridCols,
                    width,
                    height,
                    starMaxRadius
                )
            );
        }
        return result;
    }, [viewportDimensions, activeCells, gridRows, gridCols, starMaxRadius]);

    return useMemo(() => {
        const entryFuel: number = galaxyConstants?.entryFuel ?? 0;
        const maxSatellites: number = galaxyConstants?.maxSatellites ?? 0;
        const result: StarProps[] = [];
        if (stars.length > 0) {
            result.push({
                x: starCentroids[0].x,
                y: starCentroids[0].y,
                radius: computeStarRadius(
                    stars[0].fuel,
                    starMaxRadius,
                    entryFuel,
                    maxSatellites
                ),
                fuelChangeRate: stars[0].fuelChangeRate
            });
        }

        for (let i = 1; i < stars.length; i++) {
            const starStats: StarData = stars[i];
            const radius: number = computeStarRadius(starStats.fuel, starMaxRadius, entryFuel, maxSatellites);
            result.push({
                x: starCentroids[i].x,
                y: starCentroids[i].y,
                radius: radius,
                fuelChangeRate: starStats.fuelChangeRate
            });
        }
        return [result, starMaxRadius];
    }, [stars]);
}


function computeGridDimensions(
    nStars: number,
    width: number,
    height: number
): [number, number] {

    // fallback to a minimum size of 3x3
    if (nStars < 10) {
        return [3, 3];
    }

    // try to make the rows and column counts such that the cells for
    // each star can be as square as possible (maximize the radius of stars)
    const minRows: number = Math.sqrt(nStars * height / width);
    const minCols: number = nStars / minRows;
    const rows: number = Math.ceil((minRows % 2) === 0 ? minRows + 1 : minRows);
    const cols: number = Math.ceil((minCols % 2) === 0 ? minCols + 1 : minCols);

    // sanity check
    if (rows * cols < nStars) {
        throw new Error("Not enough cells to cover all stars.");
    }

    return [rows, cols];
}


function generatePlayableStarsActiveCells(nStars: number, gridRows: number, gridCols: number): number[] {
    const nCells: number = gridCols*gridRows;
    const sourceIndex: number = Math.floor(nCells / 2);
    const seeds: number[] = Array(nCells).fill(0).map(Math.random);
    const indices: number[] = seeds.map((s, i) => [s, i])
        .sort(([aS], [bS]) => aS - bS)
        // I dont like the unused vars lint when using a dummy variable
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        .map(([_, i]) => i);

    const indicesWithoutSource: number[] = indices.filter(i => i !== sourceIndex);
    return indicesWithoutSource.slice(0, nStars - 1); // dont include source star
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


function computeStarCoordinates(
    cellIndex: number,
    nRows: number,
    nCols: number,
    viewportWidth: number,
    viewportHeight: number,
    starMaxRadius: number
): Point2D {
    const rowIndex: number = Math.floor(cellIndex / nCols);
    const colIndex: number = cellIndex % nCols;
    const innerPadding: number = 0.7*starMaxRadius;
    const placementWidth: number = viewportWidth - 2*innerPadding;
    const placementHeight: number = viewportHeight - 2*innerPadding;
    const cellWidth: number = placementWidth / nCols;
    const cellHeight: number = placementHeight / nRows;
    // give each star a bit of jitter to make it look more natural
    return {
        x: cellWidth*(colIndex + Math.random()) + innerPadding,
        y: cellHeight*(rowIndex + Math.random()) + innerPadding
    };
}


interface Point2D {
    x: number;
    y: number;
}
