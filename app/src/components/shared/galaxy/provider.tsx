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
        isHovered: boolean;
        data: StarData | undefined;
        index: number | undefined;
        set: (index: number | undefined) => void;
        onHoverChange: (hovered: boolean) => void;
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
    const [focalStarHovered, setFocalStarHovered] = useState<boolean>(false);
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


    const value: ActiveGalaxyContextState = {
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
            isHovered: focalStarHovered,
            set: setFocalStarIndex,
            isSource: focalStarIndex === 0,
            onHoverChange: setFocalStarHovered,
            addOnClick: addFocalStarOnClick,
            onClick: focalStarOnClick
        }
    };

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


// Adapted from Game::update_bucket_balances in the program
//
// Note to self: two buckets with zero players will, in general, not end up with the same balance at
// steady state. Since buckets with zero players have no outflow, there's no mechanism for them to
// equilibrate with other buckets with the same number of players. I believe this applies to any
// two buckets with the same number of players.
// function computeBucketSnapshots(game: GameEnriched): BucketSnapshot[] {
function computeBucketSnapshots(game: GameEnriched): BucketSnapshot[] {
    // while the BN's here could be large enough to cause an overflow error, it's highly unlikely
    // a game would reach that state, so we'll use toNumber()
    const now: number = new Date().getTime();
    const secondsSinceLastUpdate: number = (now / 1000) - game.state.lastUpdateEpochSeconds.toNumber();
    const spillRateConfigured: number = game.config.spillRateDecimalTokensPerSecondPerPlayer.toNumber();
    const buckets: BucketEnriched[] = game.state.buckets;
    const nBucketsIncludingHolding: number = buckets.length;
    const inflow: number[] = Array(nBucketsIncludingHolding).fill(0);
    const outflow: number[] = Array(nBucketsIncludingHolding).fill(0);
    for (let i = 0; i < nBucketsIncludingHolding; i++) {
        const bucketI: BucketEnriched = buckets[i];
        const spilloverIExpected: number = computeExpectedSpillover(
            bucketI,
            spillRateConfigured,
            secondsSinceLastUpdate
        );
        // only spill to buckets with fewer players than this one
        const targetIndices: number[] = buckets.flatMap((b, j) =>
            (j !== 0) && (j !== i) && (b.players < bucketI.players) ? [j] : []
        );
        const targetCount: number = targetIndices.length;
        const spilloverToJ: number = targetCount === 0 ? 0 : Math.floor(spilloverIExpected / targetCount);
        const spilloverI: number = spilloverToJ * targetCount;
        outflow[i] = spilloverI;
        targetIndices.forEach(j => inflow[j] += spilloverToJ);
    }
    return buckets.map((b, i) => ({
        decimalTokens: b.decimalTokens.toNumber() + inflow[i] - outflow[i],
        players: b.players,
        changeRate: (inflow[i] - outflow[i]) / secondsSinceLastUpdate
    }));
}


function computeExpectedSpillover(bucket: Bucket, spillRateConfigured: number, secondsSinceLastUpdate: number): number {
    const expected: number = bucket.players * spillRateConfigured * secondsSinceLastUpdate;
    return Math.min(bucket.decimalTokens.toNumber(), expected);
}
