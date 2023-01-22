import {
    Group,
    Text,
    ScrollArea,
} from "@mantine/core";
import { PublicKey } from "@solana/web3.js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useEquilibrate } from "../../../lib/equilibrate/provider";
import { Bucket, Game, GameConfigEnriched } from "../../../lib/equilibrate/types";
import { GamesListEntry } from "../../../lib/equilibrate/sdk";
import { useActiveGame } from "../../shared/game/provider";
import { useInterval } from "../../../lib/shared/useInterval";
import { BONK_FAUCET, GAMES_LIST_UPDATE_INTERVAL } from "../../../lib/shared/constants";
import { useGame } from "../../../lib/equilibrate/useGame";
import { Notifications, notifyError, notifySuccess, notifyWarning } from "../../../lib/shared/notifications";
import { SettingsMenu } from "./SettingsMenu";
import styles from "./styles.module.css";
import { useMintList } from "../../../lib/shared/mint-list";
import { NATIVE_MINT } from "@solana/spl-token";
import { formatTokens, formatTokensShort } from "../../../lib/shared/number";
import { Button } from "../../shared/model/button";
import { useEndpoint } from "../../../lib/solana/provider";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useInsertConnectWallet } from "../../../lib/shared/useInsertConnectWallet";
import { Duration } from "../../../lib/shared/duration";
import * as anchor from "@project-serum/anchor";
import { getTokenBalance, sendTokens } from "../../../dev/token";
import { makeTransactionUrl, useMakeTransactionUrl } from "../../../lib/shared/transaction";

interface SetGameFunction {
    (address: PublicKey): void;
}


export function Sidebar(): JSX.Element {
    const gamesListContext = useGamesList();
    const { isProd } = useEndpoint();

    return (
        <nav className={styles["sidebar"]}>
            <Text className={styles["title"]}>B🔥nket</Text>
            {!isProd && <BonkFaucet/>}
            <div className={styles["header"]}>
                <Group spacing={3}>
                    <Text>Games</Text>
                </Group>
                <Group spacing={0}>
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

const BONK_COOLDOWN: Duration = Duration.ofMinutes(1);
const BONK_MINT: PublicKey = new PublicKey("bonkKjzREa7pVBRD6nFPAKRaHhS7XpDhhgZCZdGNkuU");
const BONK_AIRDROP_AMOUNT: number = 1e6*Math.pow(10, 5);

function BonkFaucet(): JSX.Element {
    const [cooldownEnd, setCooldownEnd] = useState<Date>(new Date(0));
    const { connection } = useConnection();
    const connectWalletIfNeeded = useInsertConnectWallet();
    const makeTransactionUrl = useMakeTransactionUrl();

    const onClick = useCallback(async () => {
        if (await getTokenBalance(BONK_MINT, BONK_FAUCET.publicKey, connection) < BONK_AIRDROP_AMOUNT) {
            notifyError("Faucet is empty :(");
            return;
        }
        const cooldownRemaining: number = cooldownEnd.getTime() - new Date().getTime();
        if (cooldownRemaining > 0) {
            const cooldownSeconds: number = Math.floor(Duration.ofMilliseconds(cooldownRemaining).asSeconds());
            notifyWarning(`BONK! On cooldown for another ${cooldownSeconds} seconds`);

        } else {
            connectWalletIfNeeded((destination) => {
                sendTokens(BONK_FAUCET, destination, BONK_MINT, BONK_AIRDROP_AMOUNT, connection)
                    .then(sig => {
                        notifySuccess("Bonk sent!", "See developer console for transaction URL.");
                        console.log("Bonk sent! See on solana explorer", makeTransactionUrl(sig));
                        setCooldownEnd(BONK_COOLDOWN.fromNow());
                    })
                    .catch(e => {
                        notifyError("Bonk failed :/", e);
                    });
            });
        }
    }, [connectWalletIfNeeded, connection, cooldownEnd, makeTransactionUrl]);

    return (
        <Button onClick={onClick}>
            <Text size="xs">Get 1M $BONK</Text>
        </Button>
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

            // then list all games the user is in
            } else if (a.userIsPlaying && !b.userIsPlaying) {
                return -1;

            } else if (!a.userIsPlaying && b.userIsPlaying) {
                return 1;

            } else {
                // sort descending by game fee vs total money in pool
                const aEntryFee: number = a.account.config.entryFeeDecimalTokens.toNumber();
                const aRatio: number = aEntryFee / computeGamePoolTotal(b.account);

                const bEntryFee: number = b.account.config.entryFeeDecimalTokens.toNumber();
                const bRatio: number = bEntryFee / computeGamePoolTotal(b.account);

                return bRatio - aRatio;
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

    const entryFeeWithoutDecimals: string = useMemo(() =>
        formatTokens(gameConfig.entryFeeDecimalTokens.toNumber(), gameConfig.mintDecimals),
    [gameConfig.entryFeeDecimalTokens, gameConfig.mintDecimals]);

    const totalTokensWithoutDecimals: string = useMemo(() => {
        const resultNumber: number = buckets.reduce((sum, bucket) => sum + bucket.decimalTokens.toNumber(), 0);
        return formatTokens(resultNumber, gameConfig.mintDecimals);
    }, [props.entry, buckets]);

    const mintName: string = useMemo(() => {
        let result: string;
        const pubkeyString: string = gameConfig.mint.toBase58();
        if (pubkeyString === NATIVE_MINT.toBase58()) {
            result = "SOL";

        } else if (props.entry.mintName !== undefined) {
            result = props.entry.mintName;

        } else {
            result = pubkeyString.slice(0, 4) + "...";
        }
        return result;
    }, [props.entry.mintName, gameConfig.mint]);

    return (
        <button
            className={`${styles["card"]} ${props.selected && styles["selected"]}`}
            onClick={() => props.setGame(props.entry.publicKey)}
        >
            <Text size="sm">Pot: {totalTokensWithoutDecimals} {mintName}</Text>
            <Text size="sm">Entry: {entryFeeWithoutDecimals} {mintName}</Text>
            {(gameConfig.burnRateDecimalTokensPerMove.toNumber() > 0) && (
                <Text size="sm">Burn: {
                    formatTokensShort(gameConfig.burnRateDecimalTokensPerMove.toNumber(), gameConfig.mintDecimals)
                } / move</Text>
            )}
            <Group noWrap>
                <Text size="sm">Players: {`${buckets[0].players} / ${gameConfig.maxPlayers}`}</Text>
                {
                    userIsPlaying && <Text size="xs" title="You're in this game">🔆</Text>
                }
            </Group>
        </button>
    );
}
