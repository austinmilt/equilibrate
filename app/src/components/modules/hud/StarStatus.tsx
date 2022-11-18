import { RingProgress, Center, Text, Image } from "@mantine/core";
import { useMemo } from "react";
import { StarData } from "../../shared/galaxy/provider";
import { InlineStyles } from "../../shared/inline-styles";
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
            <SatelliteGuage {...props}/>
            <FuelGuage {...props}/>
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
            return "...";
        } else if (props.data.fuelChangeRate > 0) {
            return "▲";
        } else if (props.data.fuelChangeRate < 0) {
            return "⯆";
        } else {
            return "...";
        }
    }, [props.data?.fuelChangeRate]);


    return (
        <div className={styles["status-gauge"]}>
            <RingProgress
                size={InlineStyles.STAR_STATUS_GAUGE.size}
                roundCaps
                thickness={3}
                sections={[{ value: ringPercent, color: InlineStyles.GLOBAL.colorHydrogen }]}
                label={
                    <Center>
                        <Image src={ HydrogenIcon } alt="H" width={InlineStyles.STAR_STATUS_GAUGE.labelSize}/>
                    </Center>
                }
            />
            <Text size="md">{fuelFormatted && `${fuelDirectionIndicator} ${fuelFormatted}`}</Text>
        </div>
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


    const showLabel: boolean = useMemo(() =>
        (!props.isSourceStar && (props.data !== undefined)),
    [props.isSourceStar, props.data]);


    return (
        <div className={styles["status-gauge"]}>
            <RingProgress
                size={InlineStyles.STAR_STATUS_GAUGE.size}
                roundCaps
                thickness={3}
                sections={[{ value: ringPercent, color: InlineStyles.GLOBAL.colorPlayer }]}
                label={<Center>🚀</Center>}
            />
            <Text size="md">{showLabel && `${props.isSourceStar ? 0 : props.data?.satellites}`}</Text>
        </div>
    );
}
