import { RingProgress, Center, Text, Image } from "@mantine/core";
import { useMemo } from "react";
import { formatTokens, formatTokensShort } from "../../../lib/shared/number";
import { StarData } from "../../shared/galaxy/provider";
import { InlineStyles } from "../../shared/inline-styles";
import styles from "./styles.module.css";
import { useGame } from "../../../lib/equilibrate/useGame";
import { useActiveGame } from "../../shared/game/provider";
import { GameConfigEnriched } from "../../../lib/equilibrate/types";
import HydrogenIcon from "./hydrogen-icon.svg";
import { MoneyIcon } from "../../shared/icons/MoneyIcon";
import { Themed, themed } from "../../shared/theme";
import { PlayersIcon } from "../../shared/icons/PlayersIcon";

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
    const { address: gameAddress } = useActiveGame();
    const gameContext = useGame(gameAddress);

    const gameConfig: GameConfigEnriched | undefined = useMemo(() => (
        gameContext.game?.game?.config
    ), [gameContext.game?.game?.config]);

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
        return themed(
            formatTokens(props.data.fuel, gameConfig?.mintDecimals),
            formatTokensShort(props.data.fuel)
        );
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
                        <Themed.Boring>
                            <MoneyIcon className={styles["status-label"]}/>
                        </Themed.Boring>
                        <Themed.Star>
                            <Image src={ HydrogenIcon } alt="H" width={InlineStyles.STAR_STATUS_GAUGE.labelSize}/>
                        </Themed.Star>
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
                label={<Center><PlayersIcon className={styles["status-label"]}/></Center>}
            />
            <Text size="md">{showLabel && `${props.isSourceStar ? 0 : props.data?.satellites}`}</Text>
        </div>
    );
}
