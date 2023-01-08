import { Tooltip, Text } from "@mantine/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GameContext, useGame, UseGameError, UseGameErrorCode } from "../../../lib/equilibrate/useGame";
import { ActiveGalaxyContextState, StarData, useActiveGalaxy } from "../../shared/galaxy/provider";
import { ActiveGameContextState, useActiveGame } from "../../shared/game/provider";
import { ShipLog, useCleanShipLogs, useShipLogs } from "./ShipLog";
import { Notifications, notifyError, notifyPotentialBug, notifySuccess } from "../../../lib/shared/notifications";
import { useMakeTransactionUrl } from "../../../lib/shared/transaction";
import { useInsertConnectWallet } from "../../../lib/shared/useInsertConnectWallet";
import { Connection, PublicKey } from "@solana/web3.js";
import { useEquilibrate } from "../../../lib/equilibrate/provider";
import { PlayerState } from "../../../lib/equilibrate/types";
import { formatTokens, formatTokensShort } from "../../../lib/shared/number";
import { useConnection } from "@solana/wallet-adapter-react";
import { MoneyIcon } from "../../shared/icons/MoneyIcon";
import { themed } from "../../shared/theme";
import { PlayersIcon } from "../../shared/icons/PlayersIcon";
import { Button } from "../../shared/model/button";
import styles from "./styles.module.css";
import { BucketIcon } from "../../shared/icons/BucketIcon";


export function HudBoring(): JSX.Element {
    const [cancelOnLoss, setCancelOnLoss] = useState<boolean>(false);
    const [overridePlayer, setOverridePlayer] = useState<PublicKey | undefined>();
    const activeGalaxyContext: ActiveGalaxyContextState = useActiveGalaxy();
    const { address: activeGame }: ActiveGameContextState = useActiveGame();
    const gameContext: GameContext = useGame(activeGame);
    const shipLogContext = useShipLogs(activeGame);
    const connectWalletIfNeeded = useInsertConnectWallet();
    const makeTransactionUrl = useMakeTransactionUrl();
    const { equilibrate, player } = useEquilibrate();
    const { connection } = useConnection();
    const [playerInGame, setPlayerInGame] = useState<boolean | null>(null);
    useCleanShipLogs();

    // update when we initially load the player/game state for the active game
    useEffect(() => {
        setOverridePlayer(player);
    }, [player]);

    useEffect(() => {
        const updatePlayerInGame = async () => {
            let result: boolean | null = null;
            if (activeGame !== undefined) {
                let playerState: PlayerState | null = gameContext.player?.player ?? null;
                if (overridePlayer !== undefined) {
                    playerState = await equilibrate.getPlayerState(activeGame, overridePlayer);
                    result = playerState != null;
                }

                // only try to get the player state for the configured player if
                // we dont already have the player state from the game context, since
                // they should be equivalent
                if ((playerState === null) &&
                    (gameContext.player !== undefined) &&
                    (player !== undefined)
                ) {
                    playerState = await equilibrate.getPlayerState(activeGame, player);
                    result = playerState != null;
                }
            }
            setPlayerInGame(result);
        };
        updatePlayerInGame();
    }, [gameContext.player, overridePlayer, equilibrate.getPlayerState, setPlayerInGame]);


    const enterSystem: (i: number, p: PublicKey) => Promise<void> = useCallback(async (starIndex, player) => {
        gameContext.enterGame(
            starIndex,
            {
                player: player,
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


    const moveShip: (i: number, p: PublicKey) => Promise<void> = useCallback(async (starIndex, player) => {
        gameContext.moveBucket(
            starIndex,
            {
                player: player,
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


    const leaveSystem: (player: PublicKey) => Promise<void> = useCallback(async (player) => {
        gameContext.leaveGame(
            cancelOnLoss,
            {
                player: player,
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

                        } else if (signature !== undefined) {
                            const winnings: number | undefined = await tryToEstimateWinnings(signature, connection);
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


    const getBucketButtonProps: (index: number) => BucketButtonProps = useCallback((index) => {
        let result: BucketButtonProps;
        if (playerInGame === null) {
            if (index === 0) {
                result = {
                    label: "Connect Wallet",
                    disabled: false,
                    onClick: () => connectWalletIfNeeded(setOverridePlayer)
                };
            } else {
                result = {
                    label: <BucketIcon text={`${index}`} classNames={{bucket: styles["bucket-button-icon"]}}/>,
                    disabled: true,
                    onClick: () => connectWalletIfNeeded((player) => {
                        enterSystem(index, player).catch(handleError);
                    })
                };
            }
        } else if (playerInGame) {
            if (index === 0) {
                result = {
                    label: "Cash Out",
                    disabled: false,
                    onClick: () => connectWalletIfNeeded((player) => {
                        leaveSystem(player).catch(handleError);
                    })
                };
            } else if (activeGalaxyContext.playerStar.index === index) {
                result = {
                    label: "You are Here",
                    disabled: true,
                    onClick: () => Notifications.enterCurrentStar()
                };
            } else {
                result = {
                    label: <>
                        Move to <BucketIcon text={`${index}`} classNames={{bucket: styles["bucket-button-icon"]}}/>
                    </>,
                    disabled: false,
                    onClick: () => connectWalletIfNeeded((player) => {
                        moveShip(index, player).catch(handleError);
                    })
                };
            }
        } else {
            if (index === 0) {
                result = {
                    label: "Not in Game",
                    disabled: true,
                    onClick: () => Notifications.enterWormholeOrbit()
                };
            } else {
                result = {
                    label: <>
                        Enter <BucketIcon text={`${index}`} classNames={{bucket: styles["bucket-button-icon"]}}/>
                    </>,
                    disabled: false,
                    onClick: () => connectWalletIfNeeded((player) => {
                        enterSystem(index, player).catch(handleError);
                    })
                };
            }
        }

        return result;

        function handleError(e: Error) {
            console.error(e);
            notifyPotentialBug(`HUD error: ${(e as unknown as Error).message}`);
        }
    }, [
        activeGalaxyContext.playerStar.index,
        playerInGame,
        enterSystem,
        moveShip,
        leaveSystem,
        connectWalletIfNeeded,
    ]);


    const abortSwitchTooltip: string = useMemo(() =>
        cancelOnLoss ?
            (
                "The game will reject your attempt to leave if you would leave with less than the game's entry fee. " +
                    "This does not include the program's flat fee to play."
            ) :
            "The game will approve your attempt to leave regardless of your winnings.",
    [cancelOnLoss]);


    const playerApproximateWinnings: string | undefined = useMemo(() => {
        let result: string | undefined;
        const playerStar: StarData | undefined = activeGalaxyContext.playerStar.data;
        if ((playerStar !== undefined) && (playerStar.satellites > 0)) {
            result = formatTokens(playerStar.fuel / playerStar.satellites, gameContext.game?.game?.config.mintDecimals);
        }
        return result;
    }, [activeGalaxyContext.playerStar.data]);


    //TODO extract styles
    return <>
        <table style={{width: "100%"}}>
            <tbody>
                <tr style={{display: "flex", flexDirection: "row", justifyContent: "space-around"}}>
                    {activeGalaxyContext.stars?.map((star, i) => (
                        <td key={i} style={{display: "flex", flexDirection: "column"}}>
                            <div style={{display: "flex", flexDirection: "row", justifyContent: "space-between", padding: "0.2rem", gap: "1rem"}}>
                                <div style={{display: "flex", flexDirection: "row", flexWrap: "nowrap", gap: "0.2rem"}}>
                                    <div style={{width: "1rem"}}><MoneyIcon/></div> {formatTokensShort(star.fuel, 9)}
                                </div>
                                {i > 0 &&
                                    <div style={{display: "flex", flexDirection: "row", flexWrap: "nowrap", gap: "0.2rem"}}>
                                        <div style={{width: "1rem"}}><PlayersIcon/></div> {star.satellites}
                                    </div>
                                }
                            </div>
                            {i === 0 && <Text>Faucet</Text>}
                            {i > 0 && <BucketButton {...getBucketButtonProps(i)}/>}
                        </td>
                    ))}
                </tr>
            </tbody>
        </table>

        <div className={styles["hud"]}>
            {activeGame && (
                <>
                    <ShipLog gameAddress={activeGame}/>
                    <Tooltip label={abortSwitchTooltip} multiline width={300}>
                        <button className={styles["abort-switch"]} onClick={() => setCancelOnLoss(!cancelOnLoss)}>
                            { cancelOnLoss ? "💎" : "📃" }
                        </button>
                    </Tooltip>
                    { playerApproximateWinnings && (
                        <div style={{display: "flex", flexDirection: "column", alignItems: "start"}}>
                            <div style={{display: "flex", flexDirection: "row", justifyContent: "center", alignItems: "center", gap: "0.5rem"}}>
                                <BucketButton {...getBucketButtonProps(0)} className={styles["faucet-button"]}/>
                                <MoneyIcon className={styles["winnings-icon"]}/>
                                <Text size="xl">{playerApproximateWinnings}</Text>
                            </div>
                            <Text size="sm" color="dimmed">Your approximate winnings if you cash out now.</Text>
                        </div>
                    )}
                </>
            )}
        </div>
    </>;
}


interface BucketButtonProps {
    label: React.ReactNode;
    disabled: boolean;
    onClick: () => void;
    className?: string;
}


function BucketButton(props: BucketButtonProps): JSX.Element {
    return <Button
        disabled={props.disabled}
        onClick={props.onClick}
        className={props.className}
    >
        {props.label}
    </Button>;
}


async function tryToEstimateWinnings(
    transactionSignature: string,
    connection: Connection
): Promise<number | undefined> {

    let winnings: number | undefined;
    const transactionResponse = await connection.getTransaction(transactionSignature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 10
    });
    if ((transactionResponse?.meta?.preTokenBalances != null)
        && (transactionResponse?.meta?.postTokenBalances != null)
    ) {
        // for some reason the number will be set to null when it's zero, even though
        // the text versions show it as zero
        const poolBalanceBefore: number = transactionResponse.meta
            .preTokenBalances[0]
            .uiTokenAmount
            .uiAmount ?? 0;

        const poolBalanceAfter: number = transactionResponse.meta
            .postTokenBalances[0]
            .uiTokenAmount
            .uiAmount ?? 0;

        if ((poolBalanceBefore !== null) && (poolBalanceAfter !== null)) {
            // I know this looks backwards, but the account being queried is the token pool
            // of the program (or at least I think it is), so we're looking for the loss
            // of tokens to find out what's going to the player
            winnings = poolBalanceBefore - poolBalanceAfter;
        }
    }

    return winnings;
}
