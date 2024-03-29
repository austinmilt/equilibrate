import { Tooltip, Text, Center, Loader } from "@mantine/core";
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
                if (gameContext.player?.leave != null) {
                    result = false;

                } else if ((gameContext.player?.enter != null) ||
                    (gameContext.player?.move != null) ||
                    (gameContext.player?.new)
                ) {
                    result = true;

                } else {
                    if (overridePlayer !== undefined) {
                        result = await equilibrate.playerInGame(activeGame, overridePlayer);
                    }

                    if (!result) {
                        result = await equilibrate.playerInGame(activeGame, player);
                    }
                }
            }
            setPlayerInGame(result);
        };
        updatePlayerInGame();
    }, [
        gameContext.player?.leave,
        gameContext.player?.enter,
        gameContext.player?.move,
        gameContext.player?.new,
        activeGame,
        player,
        overridePlayer,
        setPlayerInGame
    ]);


    useEffect(() => {
        if (gameContext.player?.leave != null) {
            setPlayerInGame(false);

        } else if (gameContext.player?.enter != null) {
            setPlayerInGame(true);
        }
    }, [gameContext.player?.leave, gameContext.player?.enter, setPlayerInGame]);


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
                            text: themed(`Entered bucket ${starIndex}`, "Entered the system."),
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
                            text: themed(`Moved to bucket ${starIndex}`, "Moved ship."),
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
                            const winnings: number | undefined = await tryToEstimateWinnings(
                                player,
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
        if (gameContext.loading) {
            result = {
                label: <Loader variant="dots" color="lime"/>,
                disabled: true,
                onClick: () => undefined
            };
        } else if (playerInGame === null) {
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
        gameContext.loading,
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


    //TODO extract styles
    return <>
        <table style={{width: "100%"}}>
            <tbody>
                <tr style={{display: "flex", flexDirection: "row", justifyContent: "space-around"}}>
                    {activeGalaxyContext.stars?.map((star, i) => (
                        <td key={i} style={{display: "flex", flexDirection: "column", width: "100%", padding: "0.5rem"}}>
                            <div style={{display: "flex", flexDirection: "row", justifyContent: "space-between", padding: "0.2rem", gap: "1rem"}}>
                                <div style={{display: "flex", flexDirection: "row", flexWrap: "nowrap", gap: "0.2rem"}}>
                                    <div style={{width: "1rem"}}><MoneyIcon/></div> {formatTokensShort(star.fuel, mintDecimals)}
                                </div>
                                {i > 0 &&
                                    <div style={{display: "flex", flexDirection: "row", flexWrap: "nowrap", gap: "0.2rem"}}>
                                        <div style={{width: "1rem"}}><PlayersIcon/></div> {star.satellites}
                                    </div>
                                }
                            </div>
                            {(i === 0) && <Center><Text>Faucet</Text></Center>}
                            {(i > 0) && <BucketButton {...getBucketButtonProps(i)}/>}
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
                    <div style={{display: "flex", flexDirection: "column", alignItems: "start"}}>
                        <div style={{display: "flex", flexDirection: "row", justifyContent: "center", alignItems: "center", gap: "0.5rem"}}>
                            <BucketButton {...getBucketButtonProps(0)} className={styles["faucet-button"]}/>
                            <MoneyIcon className={styles["winnings-icon"]}/>
                            <Text size="xl">{ playerApproximateWinnings }</Text>
                            {
                                (playerPenalty > 0) && (
                                    <Text
                                        size="xl"
                                        title="Amount of your winnings that will be burned due to moving buckets."
                                    >
                                        (🔥{playerPenaltyString})
                                    </Text>
                                )
                            }
                        </div>
                        <Text size="sm" color="dimmed">
                            {(playerApproximateWinnings != null) ?
                                "Your approximate winnings if you cash out now." :
                                <br/>}
                        </Text>
                    </div>
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
