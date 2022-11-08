import { Text, Switch, SimpleGrid } from "@mantine/core";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { GameContext, useGame, UseGameError, UseGameErrorCode } from "../../../lib/equilibrate/useGame";
import { ActiveGalaxyContextState, useActiveGalaxy } from "../../shared/galaxy/provider";
import { ActiveGameContextState, useActiveGame } from "../../shared/game/provider";
import { StarStatus } from "./StarStatus";
import { ShipLog, cleanShipLogs, useShipLogs } from "./ShipLog";
import { Notifications, notifyError, notifyPotentialBug } from "../../../lib/shared/notifications";
import { useMakeTransactionUrl } from "../../../lib/shared/transaction";
import { useInsertConnectWallet } from "../../../lib/shared/useInsertConnectWallet";
import { PublicKey } from "@solana/web3.js";
import "./Hud.css";
import { useEquilibrate } from "../../../lib/equilibrate/provider";
import { PlayerState } from "../../../lib/equilibrate/types";

enum GameAction {
    ENTER,
    MOVE,
    LEAVE,
    TRY_ENTER_CENTRAL,
    NO_OP
}


export function Hud(): JSX.Element {
    const [cancelOnLoss, setCancelOnLoss] = useState<boolean>(false);
    const [clickedStar, setClickedStar] = useState<number | undefined>();
    const [overridePlayer, setOverridePlayer] = useState<PublicKey | undefined>();
    const [focalStarClickAction, setFocalStarClickAction] = useState<GameAction>(GameAction.NO_OP)
    const activeGalaxyContext: ActiveGalaxyContextState = useActiveGalaxy();
    const { address: activeGame }: ActiveGameContextState = useActiveGame();
    const gameContext: GameContext = useGame(activeGame);
    const makeTransactionUrl = useMakeTransactionUrl();
    const shipLogContext = useShipLogs(activeGame);
    const connectWalletIfNeeded = useInsertConnectWallet();
    const { equilibrate, player } = useEquilibrate();

    // clean up old ship logs from stale games the user has left
    useEffect(() => {
        cleanShipLogs();
    }, []);


    const getFocalStarClickAction: () => Promise<GameAction> = useCallback(async () => {
        let playerState: PlayerState | null = gameContext.player?.player ?? null;
        if (activeGame !== undefined) {
            if (overridePlayer !== undefined) {
                playerState = await equilibrate.getPlayerState(activeGame, overridePlayer)

            }

            // only try to get the player state for the configured player if
            // we dont already have the player state from the game context, since
            // they should be equivalent
            if ((playerState === null) &&
                (gameContext.player !== undefined) &&
                (player !== undefined)
            ) {
                playerState = await equilibrate.getPlayerState(activeGame, player);
            }
        }

        const focalStarIndex: number | undefined = activeGalaxyContext.focalStar.index;
        let result: GameAction = GameAction.NO_OP;
        if (focalStarIndex !== undefined) {
            // player is in the game
            if (playerState !== null) {
                if (focalStarIndex === 0) {
                    result = GameAction.LEAVE;

                } else if (playerState.bucket !== focalStarIndex) {
                    result = GameAction.MOVE;
                }
            } else {
                if (focalStarIndex === 0) {
                    result = GameAction.TRY_ENTER_CENTRAL;

                } else {
                    result = GameAction.ENTER;
                }
            }
        }
        return result;

    }, [
        activeGalaxyContext.focalStar.index,
        gameContext.player,
        player,
        activeGame,
        equilibrate.getPlayerState
    ]);


    const enterSystem: (starIndex: number) => void = useCallback(starIndex => {
        gameContext.enterGame(
            starIndex,
            {
                player: overridePlayer,
                onSuccess: ({transactionSignature: signature}) => {
                    if (signature !== undefined) {
                        shipLogContext.record({
                            text: "Entered the system.",
                            url: makeTransactionUrl(signature)
                        });
                    }
                    activeGalaxyContext.playerStar.set(starIndex);
                },
                onError: e => notifyError("Unable to enter the system.", e)
            }
        );
    }, [gameContext.enterGame, shipLogContext.record, activeGalaxyContext.playerStar.set]);


    const moveShip: (starIndex: number) => void = useCallback(starIndex => {
        gameContext.moveBucket(
            starIndex,
            {
                player: overridePlayer,
                onSuccess: ({transactionSignature: signature}) => {
                    if (signature !== undefined) {
                        shipLogContext.record({ text: "Moved ship.", url: makeTransactionUrl(signature) });
                    }
                    activeGalaxyContext.playerStar.set(starIndex);
                },
                onError: e => notifyError("Unable to move the ship.", e)
            }
        );
    }, [gameContext.moveBucket, shipLogContext.record, activeGalaxyContext.playerStar.set]);


    const leaveSystem: () => void = useCallback(() => {
        gameContext.leaveGame(
            cancelOnLoss,
            {
                player: overridePlayer,
                onSuccess: (result) => {
                    if (cancelOnLoss) {
                        if (result.anchorErrorCode === "AbortLeaveOnLoss") {
                            shipLogContext.record({ text: "Escape aborted." });
                        }
                    } else {
                        const signature: string | undefined = result.transactionSignature;
                        if (signature !== undefined) {
                            shipLogContext.record({
                                text: "Escaped the system.",
                                url: makeTransactionUrl(signature)
                            });
                        }
                        shipLogContext.onEscapeSystem();
                    }
                },
                onError: e => notifyError("Unable to leave the system.", e)
            }
        );
    }, [
        gameContext.moveBucket,
        shipLogContext.record,
        shipLogContext.onEscapeSystem,
        activeGalaxyContext.playerStar.set,
        cancelOnLoss
    ]);


    const onStarClick: (starIndex: number) => Promise<void> = useCallback(async (starIndex) => {
        try {
            const action: GameAction = await getFocalStarClickAction();
            if (action === GameAction.ENTER) {
                enterSystem(starIndex);

            } else if (action === GameAction.MOVE) {
                moveShip(starIndex);

            } else if (action === GameAction.LEAVE) {
                leaveSystem();

            } else if (action === GameAction.TRY_ENTER_CENTRAL) {
                Notifications.enterWormholeOrbit();
            }
        } catch (e) {
            console.error(e);
            notifyPotentialBug(`HUD error: ${(e as unknown as Error).message}`);
        }
    }, [enterSystem, moveShip, leaveSystem]);


    // trigger a game action after user has connected wallet and clicked a star
    useEffect(() => {
        if (clickedStar !== undefined) {
            onStarClick(clickedStar);
            setClickedStar(undefined);
        }
    }, [clickedStar]);


    // register a click event for whichever focal star is clicked on so we can
    // trigger a game action
    useEffect(() => {
        return activeGalaxyContext.focalStar.addOnClick(starIndex => {
            connectWalletIfNeeded((player, neededToConnect) => {
                if (neededToConnect) {
                    setOverridePlayer(player);

                } else {
                    setOverridePlayer(undefined);
                }

                // Ideally we'd directly call onStarClick, but this passes
                // an outdated memoized version of the function which results
                // in a failed call. This way we can still use the latest
                // version of the function in a useEffect
                setClickedStar(starIndex);
            });
        }
        );
    }, [connectWalletIfNeeded, onStarClick]);


    // handle errors
    useEffect(() => {
        if (gameContext.error) {
            if (gameContext.error instanceof UseGameError) {
                // these errors should be precluded by checks in the Hud, so
                // if they show up they are definitely a bug
                notifyPotentialBug(`Bug! (UseGameErrorCode=${UseGameErrorCode[gameContext.error.code]})`);

            } else {
                notifyError("General HUD error.", gameContext.error);
            }
        }
    }, [gameContext.error]);


    // what would happen if the user clicked the focal star?
    useEffect(() => {
        getFocalStarClickAction().then(setFocalStarClickAction);
    }, [getFocalStarClickAction, setFocalStarClickAction]);


    const clickActionHelp: ReactNode | undefined = useMemo(() => {
        let helpText: string | undefined;
        if (focalStarClickAction === GameAction.ENTER) {
            helpText = "enter";

        } else if (focalStarClickAction === GameAction.MOVE) {
            helpText = "move";

        } else if (focalStarClickAction === GameAction.LEAVE) {
            helpText = "leave";

        }
        return helpText === undefined ? undefined : <Text size="md">{`👆 to ${helpText}`}</Text>;
    }, [focalStarClickAction]);


    return <div className="hud">
        <StarStatus
            data={activeGalaxyContext.focalStar.data}
            galaxyState={activeGalaxyContext.galaxy?.state}
            isSourceStar={activeGalaxyContext.focalStar.isSource}
        />
        <SimpleGrid cols={1}>
            <Switch
                checked={cancelOnLoss}
                onChange={() => setCancelOnLoss(!cancelOnLoss)}
                size="lg"
                onLabel="Stay on loss"
                offLabel="Always leave"
            />
            { clickActionHelp }
        </SimpleGrid>
        <ShipLog gameAddress={activeGame}/>
    </div>;
}
