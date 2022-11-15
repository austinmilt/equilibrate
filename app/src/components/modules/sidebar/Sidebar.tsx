import {
    Card,
    Group,
    Image,
    Text,
    ScrollArea,
    Center
} from "@mantine/core";
import { PublicKey } from "@solana/web3.js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useEquilibrate } from "../../../lib/equilibrate/provider";
import { Bucket, Game, GameConfigEnriched } from "../../../lib/equilibrate/types";
import { GamesListEntry } from "../../../lib/equilibrate/sdk";
import { useActiveGame } from "../../shared/game/provider";
import { useInterval } from "../../../lib/shared/useInterval";
import { GAMES_LIST_UPDATE_INTERVAL } from "../../../lib/shared/constants";
import { useGame } from "../../../lib/equilibrate/useGame";
import { NewGameControl } from "./NewGameControl";
import { Notifications, notifyWarning } from "../../../lib/shared/notifications";
import { SettingsMenu } from "./SettingsMenu";
import styles from "./styles.module.css";
import { useMintList } from "../../../lib/shared/mint-list";
import { NATIVE_MINT } from "@solana/spl-token";

interface SetGameFunction {
    (address: PublicKey): void;
}


export function Sidebar(): JSX.Element {
    const gamesListContext = useGamesList();

    return (
        <nav className={styles["sidebar"]}>
            <Text className={styles["title"]}>Solfield</Text>
            <div className={styles["header"]}>
                <Group spacing={3}>
                    <Text>Games</Text>
                    <NewGameControl
                        onGameAddressResolved={ (address) => gamesListContext.selectGame(address, false) }
                        onSuccess={gamesListContext.refreshList}
                    />
                </Group>
                <Group spacing={0}>
                    <a
                        href="https://github.com/austinmilt/equilibrate"
                        className={styles["github-link"]}
                        target="_blank"
                        rel="noreferrer"
                    >
                        <Center>
                            <GithubIcon/>
                        </Center>
                    </a>
                    <SettingsMenu/>
                </Group>
            </div>
            <ScrollArea classNames={{root: styles["games-list"]}}>
                <Group spacing="xs">
                    {
                        gamesListContext.games.map(g =>
                            <GameCard
                                entry={g}
                                setGame={ (address) => gamesListContext.selectGame(address, true) }
                                selected={g.publicKey.toBase58() === gamesListContext.activeGame?.toBase58()}
                                key={g.publicKey.toBase58()}
                            />
                        )
                    }
                </Group>
            </ScrollArea>

        </nav>
    );
}


interface UseGamesListContext {
    games: GamesListEntryEnriched[];
    activeGame: PublicKey | undefined;
    selectGame: (address: PublicKey, expectExists: boolean) => void;
    refreshList: () => void;
}


interface GamesListEntryEnriched extends GamesListEntry {
    mintName: string | undefined;
}


function useGamesList(): UseGamesListContext {
    const { equilibrate, equilibrateIsReady } = useEquilibrate();
    const [gamesList, setGamesList] = useState<GamesListEntryEnriched[] | undefined>();
    const activeGameContext = useActiveGame();
    const { game: gameEvent } = useGame(activeGameContext.address);
    const mintListContext = useMintList();

    const mintNameMap: {[mint: string]: string} = useMemo(() => {
        if (!mintListContext.initialized || (mintListContext.mints == null)) return {};
        return Object.fromEntries(mintListContext.mints.map(mint => [mint.address, mint.name]));
    },
    [mintListContext.mints, mintListContext.initialized]);

    const refreshList: () => void = useCallback(() => {
        if (equilibrateIsReady) {
            equilibrate.getGamesList()
                .then(list => list.map(entry => (
                    {
                        ...entry,
                        mintName: mintNameMap[entry.account.config.mint.toBase58()]
                    }
                )))
                .then(setGamesList);
        }
    }, [equilibrate, equilibrateIsReady, mintNameMap]);


    // initial fetch
    useEffect(() => {
        if (gamesList === undefined) {
            refreshList();
        }
    }, [equilibrateIsReady, activeGameContext.address]);


    // refresh when the active game updates
    useEffect(() => {
        const gameSummaryChanged: boolean = (gameEvent?.end != null) ||
            (gameEvent?.enter != null) ||
            (gameEvent?.leave != null) ||
            (gameEvent?.new != null);

        if (gameSummaryChanged) {
            refreshList();
        }
    }, [gameEvent]);


    // refresh the list at regular intervals
    useInterval(refreshList, GAMES_LIST_UPDATE_INTERVAL.asMilliseconds());


    const gamesSorted: GamesListEntryEnriched[] = useMemo(() =>
        (gamesList ?? []).sort((a, b) => {
            // selected game is always at the top
            const activeAddressString: string | undefined = activeGameContext.address?.toBase58();
            if (a.publicKey.toBase58() === activeAddressString) {
                return -1;

            } else if (b.publicKey.toBase58() === activeAddressString) {
                return 1;

            } else {
                // sort descending by volume
                return computeGamePoolTotal(b.account) - computeGamePoolTotal(a.account);
            }
        }),
    [gamesList, activeGameContext.address]);


    // show the top sorted game if another one isnt selected
    useEffect(() => {
        if ((gamesList !== undefined) && (activeGameContext?.address === undefined) && (gamesList.length > 0)) {
            activeGameContext.set(gamesList[0].publicKey);
        }
    }, [activeGameContext.address, gamesList]);


    const onSelectGame: (game: PublicKey, expectExists: boolean) => void = useCallback(async (game, expectExists) => {
        if (!equilibrateIsReady) {
            Notifications.enterSdkNotReady();
        }
        if (expectExists && !await equilibrate.gameExists(game)) {
            notifyWarning("Game has ended.", "This game no longer exists and will be removed from the list.");
            refreshList();
        }
        activeGameContext.set(game);
    }, [equilibrateIsReady, equilibrate.gameExists, gamesList, activeGameContext.address]);


    return {
        games: gamesSorted,
        activeGame: activeGameContext.address,
        selectGame: onSelectGame,
        refreshList: refreshList
    };
}


function computeGamePoolTotal(game: Game): number {
    return game.state.buckets.reduce((total, b) => total + b.decimalTokens.toNumber(), 0);
}


interface GameCardProps {
    entry: GamesListEntryEnriched;
    setGame: SetGameFunction;
    selected: boolean;
}


// https://ui.mantine.dev/category/article-cards
function GameCard(props: GameCardProps): JSX.Element {
    const userIsPlaying: boolean | undefined = props.entry.userIsPlaying;
    const gameConfig: GameConfigEnriched = props.entry.account.config;
    const buckets: Bucket[] = props.entry.account.state.buckets;

    const entryFeeWithoutDecimals: number = useMemo(() => {
        let result: number = gameConfig.entryFeeDecimalTokens.toNumber();
        if (gameConfig.mintDecimals !== null) {
            result /= Math.pow(10, gameConfig.mintDecimals);
        }
        return result;
    }, [gameConfig.entryFeeDecimalTokens, gameConfig.mintDecimals]);

    const totalTokensWithoutDecimals: number = useMemo(() => {
        let result: number = buckets.reduce((sum, bucket) => sum + bucket.decimalTokens.toNumber(), 0);
        if (gameConfig.mintDecimals !== null) {
            result /= Math.pow(10, gameConfig.mintDecimals);
        }
        return result;
    }, [props.entry, buckets]);

    const mintName: string = useMemo(() => {
        let result: string = props.entry.mintName ?? "";
        if (gameConfig.mint.toBase58() === NATIVE_MINT.toBase58()) {
            result = "SOL";
        }
        return result;
    }, [props.entry.mintName, gameConfig.mint]);

    return (
        <button
            className={`${styles["card"]} ${props.selected && styles["selected"]}`}
            onClick={() => props.setGame(props.entry.publicKey)}
        >
            <Group noWrap>
                <Text title={`Prize pool is ${totalTokensWithoutDecimals} tokens`}>
                    {`🪙 ${totalTokensWithoutDecimals}`}
                </Text>
                <Text title={`Entry fee is ${entryFeeWithoutDecimals} tokens`} color="dimmed" size="xs">
                    {`(${entryFeeWithoutDecimals} ${mintName})`}
                </Text>
            </Group>
            <Group noWrap spacing="xs">
                <Text
                    size="xs"
                    title={`${buckets[0].players} of ${gameConfig.maxPlayers} currently playing`}
                >{`🚀 ${buckets[0].players} / ${gameConfig.maxPlayers}`}</Text>
                {
                    userIsPlaying && <Text size="xs" title="You're in this game">🔆</Text>
                }
                {
                    !userIsPlaying && <Text size="xs" title="Unsure if you're in this game">❔</Text>
                }
            </Group>
            <Text transform="uppercase" size="xs" color="dimmed" title="Game ID">
                { props.entry.account.id.toNumber() }
            </Text>
        </button>
    );
}


function GithubIcon(): JSX.Element {
    return (
        <svg
            className={styles["github-icon"]}
            viewBox="0 0 1024 1024"
            xmlns="http://www.w3.org/2000/svg"
        >
            <path
                // eslint-disable-next-line max-len
                d="M8 0C3.58 0 0 3.58 0 8C0 11.54 2.29 14.53 5.47 15.59C5.87 15.66 6.02 15.42 6.02 15.21C6.02 15.02 6.01 14.39 6.01 13.72C4 14.09 3.48 13.23 3.32 12.78C3.23 12.55 2.84 11.84 2.5 11.65C2.22 11.5 1.82 11.13 2.49 11.12C3.12 11.11 3.57 11.7 3.72 11.94C4.44 13.15 5.59 12.81 6.05 12.6C6.12 12.08 6.33 11.73 6.56 11.53C4.78 11.33 2.92 10.64 2.92 7.58C2.92 6.71 3.23 5.99 3.74 5.43C3.66 5.23 3.38 4.41 3.82 3.31C3.82 3.31 4.49 3.1 6.02 4.13C6.66 3.95 7.34 3.86 8.02 3.86C8.7 3.86 9.38 3.95 10.02 4.13C11.55 3.09 12.22 3.31 12.22 3.31C12.66 4.41 12.38 5.23 12.3 5.43C12.81 5.99 13.12 6.7 13.12 7.58C13.12 10.65 11.25 11.33 9.47 11.53C9.76 11.78 10.01 12.26 10.01 13.01C10.01 14.08 10 14.94 10 15.21C10 15.42 10.15 15.67 10.55 15.59C13.71 14.53 16 11.53 16 8C16 3.58 12.42 0 8 0Z"
                transform="scale(64)"
            />
        </svg>
    );
}
