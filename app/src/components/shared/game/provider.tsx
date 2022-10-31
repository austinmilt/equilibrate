import { PublicKey } from "@solana/web3.js";
import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { useEquilibrate } from "../../../lib/equilibrate/provider";
import { PlayerStateEvent } from "../../../lib/equilibrate/sdk";
import { PlayerState } from "../../../lib/equilibrate/types";

export interface ActiveGameContextState {
    address: PublicKey | undefined;

    /**
     * Player's state account in the active game. Will be `null` if they are not in the game.
     */
    playerState: PlayerState | null;
    set: (address: PublicKey | undefined) => void;
}


export const ActiveGameContext = createContext<ActiveGameContextState>(
    {} as ActiveGameContextState
);


export function useActiveGame(): ActiveGameContextState {
    return useContext(ActiveGameContext);
}


export function ActiveGameProvider(props: { children: ReactNode }): JSX.Element {
    const [activeGame, setActiveGame] = useState<ActiveGameContextState["address"]>();
    const { player } = useEquilibrate();
    const { playerState } = usePlayerState(player, activeGame);

    return (
        <ActiveGameContext.Provider value={{
            address: activeGame,
            playerState: playerState,
            set: setActiveGame,
        }}>
            {props.children}
        </ActiveGameContext.Provider>
    );
}


interface PlayerStateContext {
    playerState: PlayerState | null;
    loading: boolean;
    error: Error | undefined;
}


function usePlayerState(playerAddress: PublicKey | undefined, gameAddress: PublicKey | undefined): PlayerStateContext {
    const { equilibrate, equilibrateIsReady } = useEquilibrate();
    const [playerState, setPlayerState] = useState<PlayerState | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<Error | undefined>();

    // (un)subscribe to the current player state
    useEffect(() => {
        const run = async () => {
            if (equilibrateIsReady && (gameAddress !== undefined) && (playerAddress !== undefined)) {
                equilibrate.watchPlayer(
                    playerAddress,
                    gameAddress,
                    (event: PlayerStateEvent) => setPlayerState(event.player),
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
        playerState: playerState,
        loading: loading,
        error: error
    };
}
