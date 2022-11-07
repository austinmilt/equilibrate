import { Text, Switch, SimpleGrid } from "@mantine/core";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { GameContext, useGame, UseGameError, UseGameErrorCode } from "../../../lib/equilibrate/useGame";
import { ActiveGalaxyContextState, useActiveGalaxy } from "../../shared/galaxy/provider";
import { ActiveGameContextState, useActiveGame } from "../../shared/game/provider";
import { StarStatus } from "./StarStatus";
import { ShipLog, cleanShipLogs, useShipLogs } from "./ShipLog";
import { Notifications, notifyError, notifyPotentialBug, notifyWarning } from "../../../lib/shared/notifications";
import { useMakeTransactionUrl } from "../../../lib/shared/transaction";
import "./Hud.css";
import { useInsertConnectWallet } from "../../../lib/shared/useInsertConnectWallet";
import { useEquilibrate } from "../../../lib/equilibrate/provider";

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
    const activeGalaxyContext: ActiveGalaxyContextState = useActiveGalaxy();
    const { address: activeGame }: ActiveGameContextState = useActiveGame();
    const gameContext: GameContext = useGame(activeGame);
    const makeTransactionUrl = useMakeTransactionUrl();
    const shipLogContext = useShipLogs(activeGame);
    const connectWalletIfNeeded = useInsertConnectWallet();
    const { player } = useEquilibrate();

    // clean up old ship logs from stale games the user has left
    useEffect(() => {
        cleanShipLogs();
    }, []);

    // what would happen if the user clicked the focal star?
    const focalStarClickAction: GameAction = useMemo(() => {
        const focalStarIndex: number | undefined = activeGalaxyContext.focalStar.index;
        let result: GameAction = GameAction.NO_OP;
        if (focalStarIndex !== undefined) {
            // player is in the game
            if (gameContext.player !== null) {
                if (focalStarIndex === 0) {
                    result = GameAction.LEAVE;

                } else if (gameContext.player.player?.bucket !== focalStarIndex) {
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

    }, [activeGalaxyContext.focalStar.index, gameContext.player]);


    const enterSystem: (starIndex: number) => void = useCallback(starIndex => {
        gameContext.enterGame(
            starIndex,
            ({transactionSignature: signature}) => {
                if (signature !== undefined) {
                    shipLogContext.record({
                        text: "Entered the system.",
                        url: makeTransactionUrl(signature)
                    });
                }
                activeGalaxyContext.playerStar.set(starIndex);
            },
            e => notifyError("Unable to enter the system.", e)
        );
    }, [gameContext.enterGame, shipLogContext.record, activeGalaxyContext.playerStar.set]);


    const moveShip: (starIndex: number) => void = useCallback(starIndex => {
        gameContext.moveBucket(
            starIndex,
            ({transactionSignature: signature}) => {
                if (signature !== undefined) {
                    shipLogContext.record({ text: "Moved ship.", url: makeTransactionUrl(signature) });
                }
                activeGalaxyContext.playerStar.set(starIndex);
            },
            e => notifyError("Unable to move the ship.", e)
        );
    }, [gameContext.moveBucket, shipLogContext.record, activeGalaxyContext.playerStar.set]);


    const leaveSystem: () => void = useCallback(() => {
        gameContext.leaveGame(
            cancelOnLoss,
            (result) => {
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
            e => notifyError("Unable to leave the system.", e)
        );
    }, [
        gameContext.moveBucket,
        shipLogContext.record,
        shipLogContext.onEscapeSystem,
        activeGalaxyContext.playerStar.set,
        cancelOnLoss
    ]);


    const onStarClick: (starIndex: number) => void = useCallback(starIndex => {
        try {
            if (focalStarClickAction === GameAction.ENTER) {
                enterSystem(starIndex);

            } else if (focalStarClickAction === GameAction.MOVE) {
                moveShip(starIndex);

            } else if (focalStarClickAction === GameAction.LEAVE) {
                leaveSystem();

            } else if (focalStarClickAction === GameAction.TRY_ENTER_CENTRAL) {
                Notifications.enterWormholeOrbit();
            }
        } catch (e) {
            console.error(e);
            notifyPotentialBug(`HUD error: ${(e as unknown as Error).message}`);
        }
    }, [focalStarClickAction, enterSystem, moveShip, leaveSystem]);


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
            //TODO replace this with a workflow that automatically figures out
            // what the newly connected wallet's action should be before trying
            // to perform it (right now it just will decide to enter the game
            // if the player clicks without being connected first, because it
            // doesnt know that the player is one in the game).
            // TODO also note that the viewport isnt updating properly. It will show
            // that the player isnt in the game even if they are connected, in some
            // cases.
            if (player === undefined) {
                notifyWarning("Connect your wallet.", "You need to connect your wallet before you can enter the game.");
                return;
            }

            //TODO can connectWalletIfNeeded be moved to onStarClick to avoid this
            // messy setClickedStar and useEffect?
            connectWalletIfNeeded(() => {
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
