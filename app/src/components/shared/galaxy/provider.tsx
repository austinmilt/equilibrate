import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useReducer, useState } from "react";
import { Bucket, BucketEnriched, GameEnriched } from "../../../lib/equilibrate/types";
import { useGame } from "../../../lib/equilibrate/useGame";
import { VIEWPORT_UPDATE_INTERVAL_MS } from "../../../lib/shared/constants";
import { useInterval } from "../../../lib/shared/useInterval";
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


interface OnClick {
    (index: number): void;
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
        onClick: (index: number) => void;
        addOnClick: (listener: OnClick) => () => void;
    }
}


export const ActiveGalaxyContext = createContext<ActiveGalaxyContextState>(
    {} as ActiveGalaxyContextState
);


export function useActiveGalaxy(): ActiveGalaxyContextState {
    return useContext(ActiveGalaxyContext);
}


function addOnClickReducer(
    focalStarClickListeners: OnClick[],
    data: {
        action: "add" | "remove" | "clear",
        onClick?: OnClick | undefined
    }
): OnClick[] {

    switch (data.action) {
    case "add":
        if (data.onClick === undefined) {
            throw new Error("Cannot add an undefined onClick");
        }
        focalStarClickListeners.push(data.onClick);
        return focalStarClickListeners;

    case "remove":
        return focalStarClickListeners.filter(f => f !== data.onClick);

    case "clear":
        return [];

    default:
        throw new Error("Unrecognized action " + data.action);
    }
}


export function ActiveGalaxyProvider(props: { children: ReactNode }): JSX.Element {
    const { address: activeGame }: ActiveGameContextState = useActiveGame();
    const { game: gameEvent, player: playerEvent } = useGame(activeGame);
    const [stars, setStars] = useState<StarData[] | undefined>();
    const [focalStarIndex, setFocalStarIndex] = useState<ActiveGalaxyContextState["focalStar"]["index"]>();
    const [playerStarIndex, setPlayerStarIndex] = useState<ActiveGalaxyContextState["playerStar"]["index"]>();
    const [focalStarClickListeners, focalStarClickListenersDispatch] = useReducer(addOnClickReducer, []);

    // (re)set the player's existing active star when they change up the current game
    useEffect(() => {
        if (playerEvent?.player != null) {
            setPlayerStarIndex(playerEvent?.player.bucket);
        }
    }, [activeGame, playerEvent?.player]);


    const updateStarsWithGame = useCallback((game: GameEnriched) => {
        const bucketSnapshots: BucketSnapshot[] = computeBucketSnapshots(game);
        const newStars = bucketSnapshots.map(bucket => {
            const fuel: number = Math.max(0, bucket.decimalTokens);
            let fuelChangeRate: number = bucket.changeRate;
            if (fuel <= 0) {
                fuelChangeRate = 0;
            }
            return {
                satellites: bucket.players,
                fuel: fuel,
                fuelChangeRate: fuelChangeRate
            };
        });
        setStars(newStars);
    }, []);


    const updateStars = useCallback(() => {
        if (gameEvent?.game != null) {
            updateStarsWithGame(gameEvent.game);
        }
    }, [gameEvent?.game, updateStarsWithGame]);


    // update predicted game state at regular intervals
    useInterval(updateStars, VIEWPORT_UPDATE_INTERVAL_MS.asMilliseconds());


    const addFocalStarOnClick: ActiveGalaxyContextState["focalStar"]["addOnClick"] = useCallback(listener => {
        focalStarClickListenersDispatch({action: "add", onClick: listener});
        return () => focalStarClickListenersDispatch({action: "remove", onClick: listener});
    }, [focalStarClickListenersDispatch]);


    const focalStarOnClick: ActiveGalaxyContextState["focalStar"]["onClick"] = useCallback((index: number) => {
        focalStarClickListeners.forEach(onClick => onClick(index));
    }, [focalStarClickListeners]);


    const galaxyConstants: GalaxyConstants | undefined = useMemo(() => {
        return (gameEvent?.game == null) ? undefined : {
            entryFuel: gameEvent?.game?.config.entryFeeDecimalTokens.toNumber() ?? 0,
            maxSatellites: gameEvent?.game?.config.maxPlayers ?? 0
        };
    }, [gameEvent?.game?.config]);


    const galaxyState: GalaxyState | undefined = useMemo(() => {
        if (gameEvent?.game == null) return undefined;
        const buckets: Bucket[] = gameEvent?.game.state.buckets;
        return {
            totalFuel: buckets.reduce((fuel, bucket) => fuel + bucket.decimalTokens.toNumber(), 0),
            totalSatellites: buckets[0].players
        };
    }, [gameEvent?.game?.state]);


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
            isSource: focalStarIndex === 0,
            addOnClick: addFocalStarOnClick,
            onClick: focalStarOnClick
        }
    }), [stars, focalStar, galaxyConstants, galaxyState, activeGame, playerStar]);


    return (
        <ActiveGalaxyContext.Provider value={value}>
            {props.children}
        </ActiveGalaxyContext.Provider>
    );
}


interface BucketSnapshot {
    players: number;
    decimalTokens: number;
    changeRate: number;
}


// //TODO consider moving to the SDK and calling with a timestamp for `now`
// // Adapted from Game::update_bucket_balances in the program
// //
// // Note to self: two buckets with zero players will, in general, not end up with the same balance at
// // steady state. Since buckets with zero players have no outflow, there's no mechanism for them to
// // equilibrate with other buckets with the same number of players. I believe this applies to any
// // two buckets with the same number of players.
// function computeBucketSnapshots(game: GameEnriched): BucketSnapshot[] {
//     // while the BN's here could be large enough to cause an overflow error, it's highly unlikely
//     // a game would reach that state, so we'll use toNumber()
//     const now: number = new Date().getTime();
//     const secondsSinceLastUpdate: number = (now / 1000) - game.state.lastUpdateEpochSeconds.toNumber();
//     const spillRateConfigured: number = game.config.spillRateDecimalTokensPerSecondPerPlayer.toNumber();
//     const buckets: BucketEnriched[] = game.state.buckets;
//     const nBucketsIncludingHolding: number = buckets.length;
//     const nBucketsPlayable: number = nBucketsIncludingHolding - 1;
//     const outflow: number[] = buckets.map(b => computeExpectedSpillover(b, spillRateConfigured, secondsSinceLastUpdate));
//     const tokensToRedistribute: number = outflow.reduce((total, o) => total + o, 0);
//     const inflow: number[] = outflow.map((o, i) => (tokensToRedistribute - o) / (i === 0 ? nBucketsPlayable : nBucketsPlayable - 1));
//     const result: BucketSnapshot[] = buckets.map((b, i) => ({
//         players: b.players,
//         decimalTokens: b.decimalTokens.toNumber() + inflow[i] - outflow[i],
//         changeRate: (inflow[i] - outflow[i]) / secondsSinceLastUpdate
//     }));
//     return result;
// }


//TODO consider moving to the SDK and calling with a timestamp for `now`
// Adapted from Game::update_bucket_balances in the program
//
// Note to self: two buckets with zero players will, in general, not end up with the same balance at
// steady state. Since buckets with zero players have no outflow, there's no mechanism for them to
// equilibrate with other buckets with the same number of players. I believe this applies to any
// two buckets with the same number of players.
function computeBucketSnapshots(game: GameEnriched): BucketSnapshot[] {
    // while the BN's here could be large enough to cause an overflow error, it's highly unlikely
    // a game would reach that state, so we'll use toNumber()
    const now: number = new Date().getTime();
    const secondsSinceLastUpdate: number = (now / 1000) - game.state.lastUpdateEpochSeconds.toNumber();
    const spillRateConfigured: number = game.config.spillRateDecimalTokensPerSecondPerPlayer.toNumber();
    const buckets: BucketEnriched[] = game.state.buckets;
    const nBucketsIncludingHolding: number = buckets.length;
    const nBucketsPlayable: number = nBucketsIncludingHolding - 1;
    const inflow: number[] = Array(nBucketsIncludingHolding).fill(0);
    const result: BucketSnapshot[] = [];
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
        //TODO
        //TODO BIG PROBLEM: If you start with zero tokens but non-zero players (e.g. first player), then the
        //TODO program (and this code) will have tokens flowing into the bucket, but nothing flowing out because
        //TODO computeExpectedSpillover is based on the original balance of the bucket (0).
        //TODO I think to do this properly, I need to do two rounds of calculations.
        //TODO A. Expected net flow
        //TODO      1. _all_ the outflow as if it had tokens to give
        //TODO      2. _all_ the inflow from other buckets as if they had the tokens to give
        //TODO      3. expected balance change = [2] - [1]
        //TODO
        //TODO B. Actual flow and balance
        //TODO      1. ????
        //TODO
        //TODO THERE IS AN ANALYTICAL FORMULA FOR THIS. WRITE OUT equation for balance(time t, bucket i)
        //TODO      And the first derivative for change over time
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
        const balanceChange: number = inflow[i] - spilloverI;
        const balanceI: number = bucketI.decimalTokens.toNumber() + balanceChange;
        //TODO revert
        // if (i > 0 && bucketI.players > 0) {
        //     console.log({
        //         inflow: inflow[i],
        //         outflow: spilloverI,
        //         lastTokens: bucketI.decimalTokens.toNumber(),
        //         expected: bucketI.decimalTokens.toNumber() - bucketI.players * spillRateConfigured * secondsSinceLastUpdate,
        //         decimalTokens: balanceI,
        //         players: bucketI.players,
        //         spillRate: balanceChange / secondsSinceLastUpdate
        //     });
        // }
        result.push({
            decimalTokens: balanceI,
            players: bucketI.players,
            changeRate: balanceChange / secondsSinceLastUpdate
        });
    }

    return result;
}


function computeExpectedSpillover(bucket: Bucket, spillRateConfigured: number, secondsSinceLastUpdate: number): number {
    const expected: number = bucket.players * spillRateConfigured * secondsSinceLastUpdate;
    return Math.min(bucket.decimalTokens.toNumber(), expected);
}
