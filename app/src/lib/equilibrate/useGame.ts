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


interface GameActionOptions {
    player?: PublicKey;
    onSuccess?: OnSuccessFunction;
    onError?: OnErrorFunction;
    simulateOnly?: boolean;
}


export interface GameContext {
    game: GameEvent | null;
    player: PlayerStateEvent | null;
    loading: boolean;
    error: Error | undefined;
    enterGame: (bucketIndex: number, options?: GameActionOptions) => void;
    moveBucket: (bucketIndex: number, options?: GameActionOptions) => void;
    leaveGame: (cancelOnLoss: boolean, options?: GameActionOptions) => void;
}


export function useGame(gameAddress: PublicKey | undefined): GameContext {
    const { equilibrate, equilibrateIsReady, player } = useEquilibrate();
    const gameEventsContext = useGameEvents(gameAddress);
    const playerStateContext = usePlayerEvents(player, gameAddress);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<Error | undefined>();


    const enterGame: GameContext["enterGame"] = useCallback((bucketIndex, options) => {
        const onSuccess: OnSuccessFunction | undefined = options?.onSuccess;
        const onError: OnErrorFunction | undefined = options?.onError;
        const overridePlayer: PublicKey | undefined = options?.player;
        const game: GameEnriched | null = gameEventsContext.event?.game ?? null;
        if (game === null) {
            throw UseGameError.enterNullGame(gameAddress);

        } else if (!equilibrateIsReady) {
            throw UseGameError.enterSdkNotReady(gameAddress);

        } else if (bucketIndex === 0) {
            throw UseGameError.enterHoldingBucket(gameAddress);

        } else if ((overridePlayer === undefined) && (player === undefined)) {
            throw UseGameError.enterNullPlayer(gameAddress);
        }
        setLoading(true);
        equilibrate.request(overridePlayer)
            // game ID is a unix timestamp so toNumber is safe
            .setGameId(game.id.toNumber())
            .setMint(game.config.mint)
            .setPlayerBucketIndex(bucketIndex)
            .setEntryFeeDecimalTokens(game.config.entryFeeDecimalTokens.toNumber())
            .withEnterGame()
            .signAndSend(options?.simulateOnly ?? false)
            .then(signature => {
                if (onSuccess) onSuccess(signature);
            })
            .catch(e => {
                setError(e);
                if (onError) onError(e);
            })
            .finally(() => setLoading(false));

    }, [gameEventsContext.event, equilibrate, equilibrateIsReady]);


    const moveBucket: GameContext["moveBucket"] = useCallback((bucketIndex, options) => {
        const onSuccess: OnSuccessFunction | undefined = options?.onSuccess;
        const onError: OnErrorFunction | undefined = options?.onError;
        const overridePlayer: PublicKey | undefined = options?.player;
        const game: GameEnriched | null = gameEventsContext.event?.game ?? null;
        if (game === null) {
            throw UseGameError.moveNullGame(gameAddress);

        } else if (!equilibrateIsReady) {
            throw UseGameError.moveSdkNotReady(gameAddress);

        } else if (bucketIndex === 0) {
            throw UseGameError.moveHoldingBucket(gameAddress);

        } else if ((overridePlayer === undefined) && (player === undefined)) {
            throw UseGameError.enterNullPlayer(gameAddress);
        }
        setLoading(true);
        equilibrate.request(overridePlayer)
            // game ID is a unix timestamp so toNumber is safe
            .setGameId(game.id.toNumber())
            .setPlayerBucketIndex(bucketIndex)
            .withMoveBucket()
            .signAndSend(options?.simulateOnly ?? false)
            .then(signature => {
                if (onSuccess) onSuccess(signature);
            })
            .catch(e => {
                setError(e);
                if (onError) onError(e);
            })
            .finally(() => setLoading(false));

    }, [gameEventsContext.event, equilibrate, equilibrateIsReady]);


    const leaveGame: GameContext["leaveGame"] = useCallback((cancelOnLoss, options) => {
        const onSuccess: OnSuccessFunction | undefined = options?.onSuccess;
        const onError: OnErrorFunction | undefined = options?.onError;
        const overridePlayer: PublicKey | undefined = options?.player;
        const game: GameEnriched | null = gameEventsContext.event?.game ?? null;
        if (game === null) {
            throw UseGameError.leaveNullGame(gameAddress);

        } else if (!equilibrateIsReady) {
            throw UseGameError.leaveSdkNotReady(gameAddress);

        } else if ((overridePlayer === undefined) && (player === undefined)) {
            throw UseGameError.enterNullPlayer(gameAddress);
        }
        setLoading(true);
        equilibrate.request(overridePlayer)
            // game ID is a unix timestamp so toNumber is safe
            .setGameId(game.id.toNumber())
            .setMint(game.config.mint)
            .setCancelOnLoss(cancelOnLoss)
            .withLeaveGame()
            .signAndSend(options?.simulateOnly ?? false)
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
    const { equilibrate, equilibrateIsReady, player } = useEquilibrate();
    const [event, setEvent] = useState<GameEvent | null>(null);
    const [loading, setLoading] = useState<GameContext["loading"]>(false);
    const [error, setError] = useState<GameContext["error"]>();

    // (un)subscribe to the current game
    useEffect(() => {
        async function run() {
            if (equilibrateIsReady && (gameAddress !== undefined)) {
                equilibrate.watchGame(gameAddress, setEvent, true);
            }
        }

        setError(undefined);
        setLoading(true);
        run()
            .catch(setError)
            .finally(() => setLoading(false));

        return () => {
            if (equilibrateIsReady && (gameAddress !== undefined)) {
                equilibrate.stopWatchingGame(gameAddress);
            }
        };

    }, [gameAddress, equilibrateIsReady, player]);

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
            }
        };

        setError(undefined);
        setLoading(true);
        run().catch(setError).finally(() => setLoading(false));

        return () => {
            if (equilibrateIsReady && (gameAddress !== undefined) && (playerAddress !== undefined)) {
                equilibrate.stopWatchingPlayerState(playerAddress, gameAddress);
            }
        };
    }, [gameAddress, equilibrateIsReady, playerAddress]);


    return {
        event: event,
        loading: loading,
        error: error
    };
}


export class UseGameError extends Error {
    public readonly code: UseGameErrorCode;
    public readonly game: PublicKey | undefined;

    private constructor(msg: string, game: PublicKey | undefined, code: UseGameErrorCode) {
        super(msg);
        this.game = game;
        this.code = code;
    }


    public static eventNoSuchGame(game: PublicKey | undefined): UseGameError {
        return new UseGameError("No such game.", game, UseGameErrorCode.EVENT_NO_SUCH_GAME);
    }


    public static enterNullGame(game: PublicKey | undefined): UseGameError {
        return new UseGameError("Unable to enter game.", game, UseGameErrorCode.ENTER_NULL_GAME);
    }


    public static enterSdkNotReady(game: PublicKey | undefined): UseGameError {
        return new UseGameError("Unable to enter game.", game, UseGameErrorCode.ENTER_SDK_NOT_READY);
    }


    public static enterHoldingBucket(game: PublicKey | undefined): UseGameError {
        return new UseGameError("Unable to enter game.", game, UseGameErrorCode.ENTER_HOLDING_BUCKET);
    }


    public static enterNullPlayer(game: PublicKey | undefined): UseGameError {
        return new UseGameError("Unable to enter game.", game, UseGameErrorCode.ENTER_NULL_PLAYER);
    }


    public static moveNullGame(game: PublicKey | undefined): UseGameError {
        return new UseGameError("Unable to move buckets.", game, UseGameErrorCode.MOVE_NULL_GAME);
    }


    public static moveSdkNotReady(game: PublicKey | undefined): UseGameError {
        return new UseGameError("Unable to move buckets.", game, UseGameErrorCode.MOVE_SDK_NOT_READY);
    }


    public static moveHoldingBucket(game: PublicKey | undefined): UseGameError {
        return new UseGameError("Unable to move buckets.", game, UseGameErrorCode.MOVE_HOLDING_BUCKET);
    }


    public static moveNullPlayer(game: PublicKey | undefined): UseGameError {
        return new UseGameError("Unable to move buckets.", game, UseGameErrorCode.MOVE_NULL_PLAYER);
    }


    public static leaveNullGame(game: PublicKey | undefined): UseGameError {
        return new UseGameError("Unable to leave game.", game, UseGameErrorCode.LEAVE_NULL_GAME);
    }


    public static leaveSdkNotReady(game: PublicKey | undefined): UseGameError {
        return new UseGameError("Unable to leave.", game, UseGameErrorCode.LEAVE_SDK_NOT_READY);
    }


    public static leaveNullPlayer(game: PublicKey | undefined): UseGameError {
        return new UseGameError("Unable to leave.", game, UseGameErrorCode.LEAVE_NULL_PLAYER);
    }
}


export enum UseGameErrorCode {
    EVENT_NO_SUCH_GAME,
    ENTER_HOLDING_BUCKET,
    ENTER_NULL_GAME,
    ENTER_SDK_NOT_READY,
    ENTER_NULL_PLAYER,
    MOVE_HOLDING_BUCKET,
    MOVE_NULL_GAME,
    MOVE_SDK_NOT_READY,
    MOVE_NULL_PLAYER,
    LEAVE_NULL_GAME,
    LEAVE_SDK_NOT_READY,
    LEAVE_NULL_PLAYER
}
