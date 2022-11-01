import { Paper, RingProgress, Center, Text, Group, Switch } from "@mantine/core";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { GameContext, useGame } from "../../../lib/equilibrate/useGame";
import { useEndpoint } from "../../../lib/solana/provider";
import { ActiveGalaxyContextState, StarData, useActiveGalaxy } from "../../shared/galaxy/provider";
import { ActiveGameContextState, useActiveGame } from "../../shared/game/provider";
import "./Hud.css";

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
                    //TODO better UX
                    const transactionUrl = `https://explorer.solana.com/tx/${signature}?cluster=custom&customUrl=${encodeURIComponent(solanaRpcUrl)}`;
                    console.log("Entered game, view transaction at", transactionUrl);
                    activeGalaxyContext.playerStar.set(starIndex);
                });
            } else if (focalStarClickAction === GameAction.MOVE) {
                gameContext.moveBucket(starIndex, ({transactionSignature: signature}) => {
                    //TODO better UX
                    const transactionUrl = `https://explorer.solana.com/tx/${signature}?cluster=custom&customUrl=${encodeURIComponent(solanaRpcUrl)}`;
                    console.log("Moved bucket, view transaction at", transactionUrl);
                    activeGalaxyContext.playerStar.set(starIndex);
                });
            } else if (focalStarClickAction === GameAction.LEAVE) {
                gameContext.leaveGame(
                    cancelOnLoss,
                    (result) => {
                        if (cancelOnLoss) {
                            if (result.anchorErrorCode === "AbortLeaveOnLoss") {
                                //TODO better UX
                                console.log("Stayed in game because you would've lost money.");
                            }
                        } else {
                            //TODO better UX
                            const transactionUrl = `https://explorer.solana.com/tx/${result.transactionSignature}?cluster=custom&customUrl=${encodeURIComponent(solanaRpcUrl)}`;
                            console.log("Left game, view transaction at", transactionUrl);
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
        <Group>
            <Switch
                checked={cancelOnLoss}
                onChange={() => setCancelOnLoss(!cancelOnLoss)}
                size="lg"
                onLabel="Stay on loss"
                offLabel="Always leave"
            />
            { clickActionHelp }
        </Group>
    </div>;
}


interface StarStatusProps {
    data: StarData | undefined;
    galaxyState: undefined | {
        totalFuel: number,
        totalSatellites: number
    }
    isSourceStar: boolean;
}


function StarStatus(props: StarStatusProps): JSX.Element {
    return (
        <div className="star-status">
            <FuelGuage {...props}/>
            <SatelliteGuage {...props}/>
        </div>
    );
}


function FuelGuage(props: StarStatusProps): JSX.Element {
    const ringPercent: number = useMemo(() => {
        if ((props.galaxyState === undefined) || (props.data === undefined)) {
            return 0;

        } else {
            const maxFuel: number = props.galaxyState.totalFuel * props.galaxyState.totalSatellites;
            return props.data.fuel * 100 / maxFuel;
        }
    }, [props.data]);


    const fuelFormatted: string | undefined = useMemo(() => {
        if (props.data?.fuel === undefined) return undefined;
        return Math.round(props.data.fuel).toLocaleString();
    }, [props.data?.fuel]);


    const fuelDirectionIndicator: React.ReactNode = useMemo(() => {
        if (props.data === undefined) {
            return "?";
        } else if (props.data.fuelChangeRate > 0) {
            return "▲";
        } else if (props.data.fuelChangeRate < 0) {
            return "⯆";
        } else {
            return "";
        }
    }, [props.data?.fuelChangeRate]);


    return (
        <Paper withBorder radius="md" p="xs">
            <Group>
                <RingProgress
                    size={80}
                    roundCaps
                    thickness={8}
                    sections={[{ value: ringPercent, color: "#ebb729" }]}
                    label={
                        <Center>
                            ⛽
                        </Center>
                    }
                />

                <div>
                    <Text color="dimmed" size="xs" transform="uppercase" weight={700}>
                        Fuel
                    </Text>
                    <Text weight={700} size="xl">
                        { fuelDirectionIndicator } {fuelFormatted ?? "❔"}
                    </Text>
                </div>
            </Group>
        </Paper>
    );
}


function SatelliteGuage(props: StarStatusProps): JSX.Element {
    const ringPercent: number = useMemo(() => {
        if ((props.galaxyState === undefined) || (props.data === undefined) || props.isSourceStar) {
            return 0;

        } else {
            return props.data.satellites * 100 / props.galaxyState.totalSatellites;
        }
    }, [props.data]);


    return (
        <Paper withBorder radius="md" p="xs">
            <Group>
                <RingProgress
                    size={80}
                    roundCaps
                    thickness={8}
                    sections={[{ value: ringPercent, color: "grape" }]}
                    label={
                        <Center>
                            🛰️
                        </Center>
                    }
                />

                <div>
                    <Text color="dimmed" size="xs" transform="uppercase" weight={700}>
                        Satellites
                    </Text>
                    <Text weight={700} size="xl">
                        {props.isSourceStar ? 0 : (props.data?.satellites ?? "❔")}
                    </Text>
                </div>
            </Group>
        </Paper>
    );
}
