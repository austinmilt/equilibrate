import { PublicKey } from "@solana/web3.js";
import { useCallback, useEffect, useState } from "react";
import { useEquilibrate } from "./provider";
import { GameEvent } from "./sdk";
import { GameEnriched } from "./types";

export interface GameInterface {
    game: GameEnriched | null;
    loading: boolean;
    error: Error | undefined;
    enterGame: (bucketIndex: number) => void;
    moveBucket: (bucketIndex: number) => void;
    leaveGame: (cancelOnLoss: boolean) => void;
}


export function useGame(gameAddress: PublicKey): GameInterface {
    const { equilibrate, equilibrateIsReady } = useEquilibrate();
    const [game, setGame] = useState<GameEnriched | null>(null);
    const [loading, setLoading] = useState<GameInterface["loading"]>(false);
    const [error, setError] = useState<GameInterface["error"]>();

    // (un)subscribe to the current game
    useEffect(() => {
        if (equilibrateIsReady) {
            equilibrate.watchGame(gameAddress, (event: GameEvent) => {
                setGame(event.game);
            });

            return () => {
                // this is an async method so it may return after the component is unmounted :(
                equilibrate.stopWatchingGame(gameAddress);
            };
        }
    }, [gameAddress, equilibrate, equilibrateIsReady]);

    const enterGame: GameInterface["enterGame"] = useCallback((bucketIndex) => {
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
            .withEnterGame()
            .signAndSend()
            //TODO replace with better UX
            .then(signature => console.log("Entered game", signature))
            .catch(setError)
            .finally(() => setLoading(false));

    }, [game, equilibrate, equilibrateIsReady]);

    const moveBucket: GameInterface["moveBucket"] = useCallback((bucketIndex) => {
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
            .setPlayerBucketIndex(bucketIndex)
            .withMoveBucket()
            .signAndSend()
            //TODO replace with better UX
            .then(signature => console.log("Moved buckets", signature))
            .catch(setError)
            .finally(() => setLoading(false));

    }, [game, equilibrate, equilibrateIsReady]);

    const leaveGame: GameInterface["leaveGame"] = useCallback((cancelOnLoss) => {
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
            //TODO replace with better UX
            .then(signature => console.log("Left game", signature))
            .catch(setError)
            .finally(() => setLoading(false));

    }, [game, equilibrate, equilibrateIsReady]);

    return {
        game: game,
        loading: loading,
        error: error,
        enterGame: enterGame,
        moveBucket: moveBucket,
        leaveGame: leaveGame
    };
}
