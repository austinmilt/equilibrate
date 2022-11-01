import { PublicKey } from "@solana/web3.js";
import { useCallback, useEffect, useState } from "react";
import { useEquilibrate } from "./provider";
import { GameEvent, PlayerStateEvent, RequestResult } from "./sdk";
import { GameEnriched } from "./types";

interface OnSuccessFunction {
    (result: RequestResult): void;
}


interface OnErrorFunction {
    (error: Error): void;
}

export interface GameContext {
    game: GameEvent | null;
    player: PlayerStateEvent | null;
    loading: boolean;
    error: Error | undefined;
    enterGame: (bucketIndex: number, onSuccess?: OnSuccessFunction, onError?: OnErrorFunction) => void;
    moveBucket: (bucketIndex: number, onSuccess?: OnSuccessFunction, onError?: OnErrorFunction) => void;
    leaveGame: (cancelOnLoss: boolean, onSuccess?: OnSuccessFunction, onError?: OnErrorFunction) => void;
}


export function useGame(gameAddress: PublicKey | undefined): GameContext {
    const { equilibrate, equilibrateIsReady, player } = useEquilibrate();
    const gameEventsContext = useGameEvents(gameAddress);
    const playerStateContext = usePlayerEvents(player, gameAddress);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<Error | undefined>();


    const enterGame: GameContext["enterGame"] = useCallback((bucketIndex, onSuccess, onError) => {
        const game: GameEnriched | null = gameEventsContext.event?.game ?? null;
        if (game === null) {
            //TODO replace with better uX
            alert("Game is null.");
            return;

        } else if (!equilibrateIsReady) {
            //TODO replace with better uX
            alert("SDK isnt ready");
            return;
        }
        setLoading(true);
        equilibrate.request()
            // game ID is a unix timestamp so toNumber is safe
            .setGameId(game.id.toNumber())
            .setMint(game.config.mint)
            .setPlayerBucketIndex(bucketIndex)
            .setEntryFeeDecimalTokens(game.config.entryFeeDecimalTokens.toNumber())
            .withEnterGame()
            .signAndSend()
            .then(signature => {
                if (onSuccess) onSuccess(signature);
            })
            .catch(e => {
                setError(e);
                if (onError) onError(e);
            })
            .finally(() => setLoading(false));

    }, [gameEventsContext.event, equilibrate, equilibrateIsReady]);


    const moveBucket: GameContext["moveBucket"] = useCallback((bucketIndex, onSuccess, onError) => {
        const game: GameEnriched | null = gameEventsContext.event?.game ?? null;
        if (game === null) {
            //TODO replace with better uX
            alert("Game is null.");
            return;

        } else if (!equilibrateIsReady) {
            //TODO replace with better uX
            alert("SDK isnt ready");
            return;
        } else if (bucketIndex === 0) {
            //TODO replace with better uX
            alert("Not allowed to enter the holding bucket.");
            return;
        }
        setLoading(true);
        equilibrate.request()
            // game ID is a unix timestamp so toNumber is safe
            .setGameId(game.id.toNumber())
            .setPlayerBucketIndex(bucketIndex)
            .withMoveBucket()
            .signAndSend()
            .then(signature => {
                if (onSuccess) onSuccess(signature);
            })
            .catch(e => {
                setError(e);
                if (onError) onError(e);
            })
            .finally(() => setLoading(false));

    }, [gameEventsContext.event, equilibrate, equilibrateIsReady]);


    const leaveGame: GameContext["leaveGame"] = useCallback((cancelOnLoss, onSuccess, onError) => {
        const game: GameEnriched | null = gameEventsContext.event?.game ?? null;
        if (game === null) {
            //TODO replace with better uX
            alert("Game is null.");
            return;

        } else if (!equilibrateIsReady) {
            //TODO replace with better uX
            alert("SDK isnt ready");
            return;
        }
        setLoading(true);
        equilibrate.request()
            // game ID is a unix timestamp so toNumber is safe
            .setGameId(game.id.toNumber())
            .setMint(game.config.mint)
            .setCancelOnLoss(cancelOnLoss)
            .withLeaveGame()
            .signAndSend()
            .then(signature => {
                if (onSuccess) onSuccess(signature);
            })
            .catch(e => {
                setError(e);
                if (onError) onError(e);
            })
            .finally(() => setLoading(false));

    }, [gameEventsContext.event, equilibrate, equilibrateIsReady]);

    return {
        game: gameEventsContext.event,
        player: playerStateContext.event,
        loading: loading || gameEventsContext.loading || playerStateContext.loading,
        error: (error ?? gameEventsContext.error) ?? playerStateContext.error,
        enterGame: enterGame,
        moveBucket: moveBucket,
        leaveGame: leaveGame
    };
}


interface UseEventsContext<T> {
    event: T | null;
    loading: boolean;
    error: Error | undefined;
}


function useGameEvents(gameAddress: PublicKey | undefined): UseEventsContext<GameEvent> {
    const { equilibrate, equilibrateIsReady } = useEquilibrate();
    const [event, setEvent] = useState<GameEvent | null>(null);
    const [loading, setLoading] = useState<GameContext["loading"]>(false);
    const [error, setError] = useState<GameContext["error"]>();

    // (un)subscribe to the current game
    useEffect(() => {
        const run = async () => {
            if (equilibrateIsReady && (gameAddress !== undefined)) {
                if (!await equilibrate.gameExists(gameAddress)) {
                    throw UseGameError.noSuchGame(gameAddress);
                }
                equilibrate.watchGame(gameAddress, setEvent, true);

                return () => {
                    // TODO this is an async method so it may return after the component is unmounted :(
                    // TODO likely the cause of "WebSocket is already in CLOSING or CLOSED state."
                    equilibrate.stopWatchingGame(gameAddress);
                };
            }
        };

        setError(undefined);
        setLoading(true);
        run().catch(setError).finally(() => setLoading(false));
    }, [gameAddress, equilibrateIsReady]);

    return {
        event: event,
        loading: loading,
        error: error
    };
}


function usePlayerEvents(
    playerAddress: PublicKey | undefined,
    gameAddress: PublicKey | undefined
): UseEventsContext<PlayerStateEvent> {

    const { equilibrate, equilibrateIsReady } = useEquilibrate();
    const [event, setEvent] = useState<PlayerStateEvent | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<Error | undefined>();

    // (un)subscribe to the current player state
    useEffect(() => {
        const run = async () => {
            if (equilibrateIsReady && (gameAddress !== undefined) && (playerAddress !== undefined)) {
                equilibrate.watchPlayer(
                    playerAddress,
                    gameAddress,
                    setEvent,
                    true
                );

                return () => {
                    // TODO this is an async method so it may return after the component is unmounted :(
                    // TODO likely the cause of "WebSocket is already in CLOSING or CLOSED state."
                    equilibrate.stopWatchingPlayerState(playerAddress, gameAddress);
                };
            }
        };

        setError(undefined);
        setLoading(true);
        run().catch(setError).finally(() => setLoading(false));
    }, [gameAddress, equilibrateIsReady]);


    return {
        event: event,
        loading: loading,
        error: error
    };
}


export class UseGameError extends Error {
    public readonly code: UseGameErrorCode;
    public readonly game: PublicKey;

    private constructor(msg: string, game: PublicKey, code: UseGameErrorCode) {
        super(msg);
        this.game = game;
        this.code = code;
    }

    public static noSuchGame(game: PublicKey): UseGameError {
        return new UseGameError("No such game.", game, UseGameErrorCode.NO_SUCH_GAME);
    }
}


export enum UseGameErrorCode {
    NO_SUCH_GAME
}
