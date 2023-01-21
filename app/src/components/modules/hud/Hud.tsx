import { Tooltip, Text } from "@mantine/core";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { GameContext, useGame, UseGameError, UseGameErrorCode } from "../../../lib/equilibrate/useGame";
import { ActiveGalaxyContextState, StarData, useActiveGalaxy } from "../../shared/providers/galaxy";
import { ActiveGameContextState, useActiveGame } from "../../shared/providers/game";
import { StarStatus } from "./StarStatus";
import { ShipLog, useCleanShipLogs, useShipLogs } from "./ShipLog";
import { Notifications, notifyError, notifyPotentialBug, notifySuccess } from "../../../lib/shared/notifications";
import { useMakeTransactionUrl } from "../../../lib/shared/transaction";
import { useInsertConnectWallet } from "../../../lib/shared/useInsertConnectWallet";
import { Connection, PublicKey } from "@solana/web3.js";
import { useEquilibrate } from "../../../lib/equilibrate/provider";
import { PlayerState } from "../../../lib/equilibrate/types";
import { useMousePosition } from "../../../lib/shared/useMousePosition";
import { formatTokens } from "../../../lib/shared/number";
import { useConnection } from "@solana/wallet-adapter-react";
import styles from "./styles.module.css";
import { MoneyIcon } from "../../shared/icons/MoneyIcon";
import { themed } from "../../shared/theme";

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
    const [focalStarClickAction, setFocalStarClickAction] = useState<GameAction>(GameAction.NO_OP);
    const activeGalaxyContext: ActiveGalaxyContextState = useActiveGalaxy();
    const { address: activeGame }: ActiveGameContextState = useActiveGame();
    const gameContext: GameContext = useGame(activeGame);
    const shipLogContext = useShipLogs(activeGame);
    const connectWalletIfNeeded = useInsertConnectWallet();
    const makeTransactionUrl = useMakeTransactionUrl();
    const { equilibrate, player } = useEquilibrate();
    const [mouseX, mouseY] = useMousePosition();
    useCleanShipLogs();
    const { connection } = useConnection();


    const computeFocalStarClickAction: () => Promise<GameAction> = useCallback(async () => {
        let playerState: PlayerState | null = gameContext.player?.player ?? null;
        if (activeGame !== undefined) {
            if (overridePlayer !== undefined) {
                playerState = await equilibrate.getPlayerState(activeGame, overridePlayer);
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
        equilibrate.getPlayerState,
        shipLogContext.record
    ]);


    const enterSystem: (starIndex: number) => Promise<void> = useCallback(async starIndex => {
        gameContext.enterGame(
            starIndex,
            {
                player: overridePlayer,
                onSuccess: (result) => {
                    const signature: string | undefined = result.transactionSignature;
                    if (result.error !== undefined) {
                        notifyError("Unable to enter the game: " + result.error.message);
                        console.error(result.error);

                    } else if (signature !== undefined) {
                        shipLogContext.record({
                            text: themed("Entered the game.", "Entered the system."),
                            url: makeTransactionUrl(signature)
                        });
                        activeGalaxyContext.playerStar.set(starIndex);

                    } else if (result.simulationResult) {
                        notifySuccess("Enter simulated. See console for details.");
                        console.log("Enter simulation result", result.simulationResult);
                    }
                },
                onError: e => notifyError("Unable to enter the game.", e)
            }
        );
    }, [
        gameContext.enterGame,
        shipLogContext.record,
        activeGalaxyContext.playerStar.set
    ]);


    const moveShip: (starIndex: number) => Promise<void> = useCallback(async starIndex => {
        gameContext.moveBucket(
            starIndex,
            {
                player: overridePlayer,
                onSuccess: (result) => {
                    const signature: string | undefined = result.transactionSignature;
                    if (result.error !== undefined) {
                        notifyError("Unable to move: " + result.error.message);
                        console.error(result.error);

                    } else if (signature !== undefined) {
                        shipLogContext.record({
                            text: themed("Moved buckets", "Moved ship."),
                            url: makeTransactionUrl(signature)
                        });
                        activeGalaxyContext.playerStar.set(starIndex);

                    } else if (result.simulationResult) {
                        notifySuccess("Move simulated. See console for details.");
                        console.log("Move simulation result", result.simulationResult);
                    }
                },
                onError: e => notifyError("Unable to move the ship.", e),
            }
        );
    }, [
        gameContext.moveBucket,
        shipLogContext.record,
        activeGalaxyContext.playerStar.set
    ]);


    const leaveSystem: () => Promise<void> = useCallback(async () => {
        gameContext.leaveGame(
            cancelOnLoss,
            {
                player: overridePlayer,
                onSuccess: async (result) => {
                    if (cancelOnLoss) {
                        if (result.anchorErrorCode === "AbortLeaveOnLoss") {
                            shipLogContext.record({ text: themed("Exit aborted", "Escape aborted.") });
                        }
                    } else {
                        const signature: string | undefined = result.transactionSignature;
                        if (result.error !== undefined) {
                            notifyError("Unable to leave the game: " + result.error.message);
                            console.error(result.error);

                        } else if ((signature !== undefined) && (overridePlayer != null)) {
                            const winnings: number | undefined = await tryToEstimateWinnings(
                                overridePlayer,
                                signature,
                                connection
                            );
                            const log: string = winnings === undefined ?
                                themed("Left the game", "Escaped the system.") :
                                themed(
                                    `Left the game with ${formatTokens(winnings)} tokens.`,
                                    `Escaped the system with ${formatTokens(winnings)} tokens.`
                                );

                            shipLogContext.record({
                                text: log,
                                url: makeTransactionUrl(signature)
                            });
                            shipLogContext.onEscapeSystem();

                            notifySuccess(log);

                        } else if (result.simulationResult) {
                            notifySuccess("Escape simulated. See console for details.");
                            console.log("Escape simulation result", result.simulationResult);
                        }
                    }
                },
                onError: e => notifyError("Unable to leave the game.", e)
            }
        );
    }, [
        gameContext.leaveGame,
        shipLogContext.record,
        shipLogContext.onEscapeSystem,
        activeGalaxyContext.playerStar.set,
        cancelOnLoss
    ]);


    const onStarClick: (starIndex: number) => Promise<void> = useCallback(async (starIndex) => {
        try {
            const action: GameAction = await computeFocalStarClickAction();
            if (action === GameAction.ENTER) {
                await enterSystem(starIndex);

            } else if (action === GameAction.MOVE) {
                await moveShip(starIndex);

            } else if (action === GameAction.LEAVE) {
                await leaveSystem();

            } else if (action === GameAction.TRY_ENTER_CENTRAL) {
                Notifications.enterWormholeOrbit();
            }
        } catch (e) {
            console.error(e);
            notifyPotentialBug(`HUD error: ${(e as unknown as Error).message}`);
        }
    }, [enterSystem, moveShip, leaveSystem, computeFocalStarClickAction]);


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
        computeFocalStarClickAction().then(setFocalStarClickAction);
    }, [computeFocalStarClickAction, setFocalStarClickAction]);


    const clickActionHelp: ReactNode | undefined = useMemo(() => {
        if (activeGalaxyContext.focalStar.isHovered) {
            let helpText: string | undefined;
            if (focalStarClickAction === GameAction.ENTER) {
                helpText = themed(`enter Bucket ${activeGalaxyContext.focalStar.index}`, "orbit");

            } else if (focalStarClickAction === GameAction.MOVE) {
                helpText = themed(`move to Bucket ${activeGalaxyContext.focalStar.index}`, "move");

            } else if (focalStarClickAction === GameAction.LEAVE) {
                helpText = themed("leave", "escape");

            } else if (activeGalaxyContext.playerStar.index === activeGalaxyContext.focalStar.index) {
                helpText = themed("you are here", "your orbit");
            }
            return helpText === undefined ? undefined : <Text size="md">{helpText}</Text>;
        }
        return undefined;
    }, [focalStarClickAction, activeGalaxyContext.focalStar.index]);


    const abortSwitchTooltip: string = useMemo(() =>
        cancelOnLoss ?
            (
                "The game will reject your attempt to leave if you would leave with less than the game's entry fee. " +
                    "This does not include the program's flat fee to play."
            ) :
            "The game will approve your attempt to leave regardless of your winnings.",
    [cancelOnLoss]);


    const mintDecimals: number | undefined = gameContext.game?.game?.config.mintDecimals ?? undefined;


    const playerPenalty: number = useMemo(() => (
        gameContext.player?.player?.burnPenaltyDecimalTokens?.toNumber() ?? 0
    ), [gameContext.player, mintDecimals]);


    const playerPenaltyString: string = useMemo(() => (
        formatTokens(playerPenalty, mintDecimals)
    ), [playerPenalty]);


    const playerApproximateWinnings: string | undefined = useMemo(() => {
        let playerShare: number | undefined;
        const playerStar: StarData | undefined = activeGalaxyContext.playerStar.data;
        if ((activeGalaxyContext.stars != null) && (activeGalaxyContext.stars[0].satellites === 1)) {
            playerShare = activeGalaxyContext.galaxy?.state.totalFuel ?? 0;

        } else if ((playerStar !== undefined) && (playerStar.satellites > 0)) {
            playerShare = playerStar.fuel / playerStar.satellites;
        }

        let result: string | undefined;
        if (playerShare !== undefined) {
            const resultNumber: number = Math.max(0, playerShare - playerPenalty);
            result = formatTokens(resultNumber, mintDecimals);
        }
        return result;
    }, [activeGalaxyContext.playerStar.data, playerPenalty]);


    return <div className={styles["hud"]}>
        {activeGame && (
            <>
                <ShipLog gameAddress={activeGame}/>
                <Tooltip label={abortSwitchTooltip} multiline width={300}>
                    <button className={styles["abort-switch"]} onClick={() => setCancelOnLoss(!cancelOnLoss)}>
                        { cancelOnLoss ? "💎" : "📃" }
                    </button>
                </Tooltip>
                <div className={styles["star-status-and-winnings"]}>
                    <StarStatus
                        data={activeGalaxyContext.focalStar.data}
                        galaxyState={activeGalaxyContext.galaxy?.state}
                        isSourceStar={activeGalaxyContext.focalStar.isSource}
                    />
                    <Tooltip label={(
                        "Your approximate winnings if you leave now."
                    )}>
                        <div>
                            <MoneyIcon className={styles["winnings-icon"]}/>
                            <Text size="xl">{ playerApproximateWinnings }</Text>
                            {
                                (playerPenalty > 0) && (
                                    <Text
                                        size="xl"
                                        title="Amount of your winnings that will be burned due to moving your ship."
                                    >
                                        (🔥{playerPenaltyString})
                                    </Text>
                                )
                            }
                        </div>
                    </Tooltip>
                </div>
                { activeGalaxyContext.focalStar.isHovered && (
                    <div
                        className={styles["star-hover-help"]}
                        style={{
                            position: "fixed",
                            top: `${mouseY}px`,
                            left: `${mouseX}px`
                        }}
                    >
                        {clickActionHelp}
                    </div>
                )}

            </>
        )}
    </div>;
}


async function tryToEstimateWinnings(
    player: PublicKey,
    transactionSignature: string,
    connection: Connection
): Promise<number | undefined> {

    let winnings: number | undefined;
    const transactionResponse = await connection.getTransaction(transactionSignature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 10
    });
    const playerAddress: string = player.toBase58();

    const canSearchBefore: boolean = transactionResponse?.meta?.preTokenBalances != null;
    const canSearchAfter: boolean = transactionResponse?.meta?.postTokenBalances != null;
    if (canSearchBefore && canSearchAfter) {
        // for games where the player's token account isnt closed when they leave (most tokens)
        // @ts-ignore already verified
        let metaBefore = transactionResponse.meta.preTokenBalances.find(b => b.owner === playerAddress);
        // @ts-ignore already verified
        let metaAfter = transactionResponse.meta.postTokenBalances.find(b => b.owner === playerAddress);
        if ((metaBefore != null) && (metaAfter != null)) {
            // for some reason the number will be set to null when it's zero, even though
            // the text versions show it as zero
            const playerBalanceBefore: number = metaBefore.uiTokenAmount.uiAmount ?? 0;
            const playerBalanceAfter: number = metaAfter.uiTokenAmount.uiAmount ?? 0;
            winnings = playerBalanceAfter - playerBalanceBefore;
        }

        // for games where the player's token account is closed when they leave (wrapped SOL)
        if ((winnings === undefined)) {
            // @ts-ignore already verified
            metaBefore = transactionResponse.meta.preTokenBalances[0];
            // @ts-ignore already verified
            metaAfter = transactionResponse.meta.postTokenBalances[0];
            const poolBalanceBefore: number = metaBefore.uiTokenAmount.uiAmount ?? 0;
            const poolBalanceAfter: number = metaAfter.uiTokenAmount.uiAmount ?? 0;
            winnings = poolBalanceBefore - poolBalanceAfter;
        }
    }

    return winnings;
}
