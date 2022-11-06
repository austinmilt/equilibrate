import { Text, Switch, SimpleGrid } from "@mantine/core";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { GameContext, useGame } from "../../../lib/equilibrate/useGame";
import { useEndpoint } from "../../../lib/solana/provider";
import { ActiveGalaxyContextState, useActiveGalaxy } from "../../shared/galaxy/provider";
import { ActiveGameContextState, useActiveGame } from "../../shared/game/provider";
import { StarStatus } from "./StarStatus";
import "./Hud.css";
import { ShipLog, cleanShipLogs, useShipLogs } from "./ShipLog";

enum GameAction {
    ENTER,
    MOVE,
    LEAVE,
    TRY_ENTER_CENTRAL,
    NO_OP
}


export function Hud(): JSX.Element {
    const [cancelOnLoss, setCancelOnLoss] = useState<boolean>(false);
    const activeGalaxyContext: ActiveGalaxyContextState = useActiveGalaxy();
    const { address: activeGame }: ActiveGameContextState = useActiveGame();
    const gameContext: GameContext = useGame(activeGame);
    const { url: solanaRpcUrl } = useEndpoint();
    const shipLogContext = useShipLogs(activeGame);

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


    // register a click event for whichever focal star is clicked on so we can
    // trigger a game action
    useEffect(() => {
        const removeOnClick = activeGalaxyContext.focalStar.addOnClick((starIndex: number) => {
            if (focalStarClickAction === GameAction.ENTER) {
                gameContext.enterGame(starIndex, ({transactionSignature: signature}) => {
                    const transactionUrl = `https://explorer.solana.com/tx/${signature}?cluster=custom&customUrl=${encodeURIComponent(solanaRpcUrl)}`;
                    console.log("Entered game, view transaction at", transactionUrl);
                    shipLogContext.record({ text: "Entered the system.", url: transactionUrl });
                    activeGalaxyContext.playerStar.set(starIndex);
                });
            } else if (focalStarClickAction === GameAction.MOVE) {
                gameContext.moveBucket(starIndex, ({transactionSignature: signature}) => {
                    const transactionUrl = `https://explorer.solana.com/tx/${signature}?cluster=custom&customUrl=${encodeURIComponent(solanaRpcUrl)}`;
                    console.log("Moved bucket, view transaction at", transactionUrl);
                    shipLogContext.record({ text: "Orbit changed.", url: transactionUrl });
                    activeGalaxyContext.playerStar.set(starIndex);
                });
            } else if (focalStarClickAction === GameAction.LEAVE) {
                gameContext.leaveGame(
                    cancelOnLoss,
                    (result) => {
                        if (cancelOnLoss) {
                            if (result.anchorErrorCode === "AbortLeaveOnLoss") {
                                console.log("Stayed in game because you would've lost money.");
                                shipLogContext.record({ text: "Escape aborted." });
                            }
                        } else {
                            const transactionUrl = `https://explorer.solana.com/tx/${result.transactionSignature}?cluster=custom&customUrl=${encodeURIComponent(solanaRpcUrl)}`;
                            console.log("Left game, view transaction at", transactionUrl);
                            shipLogContext.record({ text: "Escaped the system.", url: transactionUrl });
                            shipLogContext.onEscapeSystem();
                        }
                    }
                );

            } else if (focalStarClickAction === GameAction.TRY_ENTER_CENTRAL) {
                //TODO better ux
                alert("Cannot enter holding bucket.");
            }
        });

        return removeOnClick;
    }, [focalStarClickAction, cancelOnLoss, gameContext.leaveGame, gameContext.enterGame, gameContext.moveBucket]);


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
