import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Bucket, BucketEnriched, GameEnriched, GameState, GameStateEnriched } from "../../../lib/equilibrate/types";
import { GameContext, useGame } from "../../../lib/equilibrate/useGame";
import { ActiveGameContextState, useActiveGame } from "../game/provider";

export interface StarData {
    fuel: number; // equivalent to bucket balance
    satellites: number; // equivalent to number of players,
    fuelChangeRate: number; // equivalent to bucket flow rate
}


export interface GalaxyConstants {
    entryFuel: number;
    maxSatellites: number;
}


export interface GalaxyState {
    totalFuel: number;
    totalSatellites: number;
}


export interface ActiveGalaxyContextState {
    galaxy: undefined | {
        constants: GalaxyConstants;
        state: GalaxyState
    }

    stars: StarData[] | undefined;

    playerStar: {
        data: StarData | undefined;
        index: number | undefined;
        set: (index: number | undefined) => void;
    }

    focalStar: {
        isSource: boolean;
        data: StarData | undefined;
        index: number | undefined;
        set: (index: number | undefined) => void;
    }
}


export const ActiveGalaxyContext = createContext<ActiveGalaxyContextState>(
    {} as ActiveGalaxyContextState
);


export function useActiveGalaxy(): ActiveGalaxyContextState {
    return useContext(ActiveGalaxyContext);
}


export function ActiveGalaxyProvider(props: { children: ReactNode }): JSX.Element {
    const [updateInterval, setUpdateIntervalObj] = useState<NodeJS.Timeout | undefined>();

    const { address: activeGame }: ActiveGameContextState = useActiveGame();
    const gameContext: GameContext = useGame(activeGame);
    const [stars, setStars] = useState<StarData[] | undefined>();
    const [focalStarIndex, setFocalStarIndex] = useState<ActiveGalaxyContextState["focalStar"]["index"]>();
    const [playerStarIndex, setPlayerStarIndex] = useState<ActiveGalaxyContextState["playerStar"]["index"]>();

    const updateStarsWithGame = useCallback((game: GameEnriched) => {
        const currentPlayerCount: number = game.state.buckets[0].players;
        const maxStarFuel: number = currentPlayerCount * game.config.entryFeeDecimalTokens.toNumber();
        const newBucketBalances: number[] = computeBucketBalances(game);
        const newStars = game.state.buckets.map((bucket, i) => {
            const fuel: number = Math.min(maxStarFuel, Math.max(0, newBucketBalances[i]));
            let fuelChangeRate: number = newBucketBalances[i];
            if ((fuel <= 0) || (fuel >= maxStarFuel)) {
                fuelChangeRate = 0;
            }
            return {
                satellites: bucket.players,
                fuel: fuel,
                fuelChangeRate: fuelChangeRate
            };
        });
        // eslint-disable-next-line max-len
        // console.log("fuel", JSON.stringify(newStars.map(s => `${s.fuel.toFixed(0)} | ${s.fuelChangeRate.toFixed(0)}`), undefined, 2));
        setStars(newStars);
    }, []);


    const updateStars = useCallback(() => {
        if (gameContext.game !== null) {
            updateStarsWithGame(gameContext.game);
        }
    }, [gameContext.game, updateStarsWithGame]);


    // update predicted game state at regular intervals
    useEffect(() => {
        if (updateInterval) {
            clearInterval(updateInterval);
        }

        const newInterval: NodeJS.Timeout = setInterval(updateStars, 100);
        setUpdateIntervalObj(newInterval);

        return () => {
            clearInterval(newInterval);
        };
    }, [ updateStars ]);


    const galaxyConstants: GalaxyConstants | undefined = useMemo(() => {
        return (gameContext.game === undefined) ? undefined : {
            entryFuel: gameContext.game?.config.entryFeeDecimalTokens.toNumber() ?? 0,
            maxSatellites: gameContext.game?.config.maxPlayers ?? 0
        };
    }, [gameContext.game?.config]);


    const galaxyState: GalaxyState | undefined = useMemo(() => {
        if (gameContext.game == null) return undefined;
        const buckets: Bucket[] = gameContext.game.state.buckets;
        return {
            totalFuel: buckets.reduce((fuel, bucket) => fuel + bucket.decimalTokens.toNumber(), 0),
            totalSatellites: buckets[0].players
        };
    }, [gameContext.game?.state]);


    const playerStar: StarData | undefined = useMemo(() => (stars !== undefined) &&
        (stars.length > 0) &&
        (playerStarIndex !== undefined) ?
        stars[playerStarIndex] :
        undefined,
    [stars, playerStarIndex]);


    const focalStar: StarData | undefined = useMemo(() => (stars !== undefined) &&
        (stars.length > 0) &&
        (focalStarIndex !== undefined) ?
        stars[focalStarIndex] :
        undefined,
    [stars, focalStarIndex]);


    const value: ActiveGalaxyContextState = useMemo(() => ({
        galaxy: ((galaxyConstants === undefined) || (galaxyState === undefined)) ? undefined : {
            constants: galaxyConstants,
            state: galaxyState
        },
        stars: stars,
        playerStar: {
            data: playerStar,
            index: playerStarIndex,
            set: setPlayerStarIndex
        },
        focalStar: {
            data: focalStar,
            index: focalStarIndex,
            set: setFocalStarIndex,
            isSource: focalStarIndex === 0
        }
    }), [stars, focalStar, galaxyConstants, galaxyState, activeGame, playerStar]);


    return (
        <ActiveGalaxyContext.Provider value={value}>
            {props.children}
        </ActiveGalaxyContext.Provider>
    );
}


//TODO consider moving to the SDK and calling with a timestamp for `now`
// same as Game::update_bucket_balances in the program
function computeBucketBalances(game: GameEnriched): number[] {
    // while the BN's here could be large enough to cause an overflow error, it's highly unlikely
    // a game would reach that state, so we'll use toNumber()
    const now: number = new Date().getTime();
    const secondsSinceLastUpdate: number = Math.floor(now / 1000) - game.state.lastUpdateEpochSeconds.toNumber();
    const spillRateConfigured: number = game.config.spillRateDecimalTokensPerSecondPerPlayer.toNumber();
    const buckets: BucketEnriched[] = game.state.buckets;
    const nBucketsIncludingHolding: number = buckets.length;
    const nBucketsPlayable: number = nBucketsIncludingHolding - 1;
    const inflow: number[] = Array(nBucketsIncludingHolding).fill(0);
    const result: number[] = [];
    for (let i = 0; i < nBucketsIncludingHolding; i++) {
        const bucketI: BucketEnriched = buckets[i];
        const iIsHolding: boolean = i === 0;
        const spilloverIExpected: number = computeExpectedSpillover(
            bucketI,
            spillRateConfigured,
            secondsSinceLastUpdate
        );
        const peersI: number = iIsHolding ? nBucketsPlayable : (nBucketsPlayable - 1);
        //TODO this floor is causing a bucket with small balance to not get rid of its last tokens, and
        //TODO that's a problem for the holding bucket especially. We should choose which bucket the remaining
        //TODO tokens need to enter (maybe the one with the lowest balance that has positive inflow rate)
        //TODO and update that in the program (and here)
        const spilloverToJ: number = Math.floor(spilloverIExpected / peersI);
        const spilloverI: number = spilloverToJ * peersI;
        for (let j = i + 1; j < nBucketsIncludingHolding; j++) {
            const bucketJ: BucketEnriched = buckets[j];
            // j will never be 0, so it's always a playable bucket
            const peersJ: number = nBucketsPlayable - 1;
            const spilloverJ: number = computeExpectedSpillover(bucketJ, spillRateConfigured, secondsSinceLastUpdate);
            const spilloverToI: number = iIsHolding ? 0 : Math.floor(spilloverJ / peersJ);
            inflow[i] += spilloverToI;
            inflow[j] += spilloverToJ;
        }
        result.push(bucketI.decimalTokens.toNumber() + inflow[i] - spilloverI);
    }

    return result;
}


function computeExpectedSpillover(bucket: Bucket, spillRateConfigured: number, secondsSinceLastUpdate: number): number {
    const expected: number = bucket.players * spillRateConfigured * secondsSinceLastUpdate;
    return Math.min(bucket.decimalTokens.toNumber(), expected);
}
