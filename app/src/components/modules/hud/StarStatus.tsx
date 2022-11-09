import { Paper, RingProgress, Center, Text, Image, Group } from "@mantine/core";
import { useMemo } from "react";
import { StarData } from "../../shared/galaxy/provider";
import HydrogenIcon from "./hydrogen-icon.svg";
import styles from "./styles.module.css";


interface StarStatusProps {
    data: StarData | undefined;
    galaxyState: undefined | {
        totalFuel: number,
        totalSatellites: number
    }
    isSourceStar: boolean;
}


export function StarStatus(props: StarStatusProps): JSX.Element {
    return (
        <div className={styles["star-status"]}>
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
                            <Image src={HydrogenIcon} alt="H" className="hydrogen-icon" width={40}/>
                        </Center>
                    }
                />

                <div>
                    <Text color="dimmed" size="xs" transform="uppercase" weight={700}>
                        Hydrogen
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
                            🚀
                        </Center>
                    }
                />

                <div>
                    <Text color="dimmed" size="xs" transform="uppercase" weight={700}>
                        Ships
                    </Text>
                    <Text weight={700} size="xl">
                        {props.isSourceStar ? 0 : (props.data?.satellites ?? "❔")}
                    </Text>
                </div>
            </Group>
        </Paper>
    );
}
