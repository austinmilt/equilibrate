import {
    Button,
    Card,
    Center,
    Group,
    Loader,
    SegmentedControl,
    Image,
    Text,
    createStyles,
    ScrollArea
} from "@mantine/core";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useEquilibrate } from "../../../lib/equilibrate/provider";
import { Endpoint, useEndpoint } from "../../../lib/solana/provider";
import { NATIVE_MINT } from "@solana/spl-token";
import { Bucket, Game, GameConfigEnriched } from "../../../lib/equilibrate/types";
import { GamesListEntry } from "../../../lib/equilibrate/sdk";
import "./GamesPanel.css";
import { useActiveGame } from "../../shared/game/provider";
import { useInterval } from "../../../lib/shared/useInterval";
import { Duration } from "../../../lib/shared/duration";

//TODO remove
const useStyles = createStyles((theme) => ({
    card: {
        backgroundColor: theme.colorScheme === "dark" ? theme.colors.dark[7] : theme.white,
        "&:hover": {
            cursor: "pointer",
            backgroundColor: theme.colors.dark[4]
        },
    },

    "card-selected": {
        backgroundColor: theme.colors.dark[4]
    },

    title: {
        fontWeight: 700,
        fontFamily: `Greycliff CF, ${theme.fontFamily}`,
        lineHeight: 1.2,
    },

    body: {
        padding: theme.spacing.md,
    },
}));

interface SetGameFunction {
    (address: PublicKey): void;
}


interface Props {
    setGame: SetGameFunction;
}


export function GamesPanel(props: Props): JSX.Element {
    const { isProd: endpointIsProd } = useEndpoint();
    const { equilibrate, equilibrateIsReady } = useEquilibrate();
    const [gamesList, setGamesList] = useState<GamesListEntry[] | undefined>();
    const { address: activeGameAddress, set: setActiveGame } = useActiveGame();

    const fetchGames: () => void = useCallback(() => {
        equilibrate.getGamesList().then(setGamesList);
    }, [equilibrate]);


    // refresh list on specific events
    useEffect(() => {
        if (equilibrateIsReady && (gamesList === undefined)) {
            fetchGames();
        }
    }, [equilibrateIsReady, activeGameAddress]);


    // refresh the list at regular intervals
    useInterval(fetchGames, Duration.ofSeconds(10).asMilliseconds());


    const gamesSorted: GamesListEntry[] = useMemo(() =>
        (gamesList ?? []).sort((a, b) => {
            // selected game is always at the top
            if (a.publicKey === activeGameAddress) {
                return -1;

            } else if (b.publicKey === activeGameAddress) {
                return 1;

            } else {
                // sort descending by volume
                return computeGamePoolTotal(b.account) - computeGamePoolTotal(a.account);
            }
        }),
    [gamesList, activeGameAddress]);


    const onSelectGame: SetGameFunction = useCallback(async game => {
        if (!equilibrateIsReady) {
            alert("SDK not ready");
        }
        if (!await equilibrate.gameExists(game)) {
            //TODO better ux
            alert("Game has ended.");
            fetchGames();
        }
        setActiveGame(game);
        props.setGame(game);
    }, [equilibrate.gameExists, gamesList, setActiveGame]);


    // show the top sorted game if another one isnt selected
    useEffect(() => {
        if ((gamesList !== undefined) && (activeGameAddress !== undefined) && (gamesList.length > 0)) {
            setActiveGame(gamesList[0].publicKey);
        }
    }, [setActiveGame, gamesList]);


    return (
        <nav className="games-nav">
            <h1 className="games-header">Games</h1>
            <Center><WalletMultiButton/></Center>
            <ClusterControl/>
            <Group>
                { !endpointIsProd && <AirdropButton/> }
                <NewGameButton setGame={ onSelectGame }/>
            </Group>
            <ScrollArea style={{height: "40vh", border: "1px solid gray"}}>
                <Group spacing="sm">
                    {
                        gamesSorted.map(g =>
                            <GameCard
                                entry={g}
                                setGame={onSelectGame}
                                selected={g.publicKey === activeGameAddress}
                                key={g.publicKey.toBase58()}
                            />
                        )
                    }
                </Group>
            </ScrollArea>
        </nav>
    );
}


function computeGamePoolTotal(game: Game): number {
    return game.state.buckets.reduce((sum, bucket) => sum + bucket.decimalTokens.toNumber(), 0);
}


function NewGameButton(props: { setGame: SetGameFunction }): JSX.Element {
    const { equilibrate, equilibrateIsReady } = useEquilibrate();
    const [loading, setLoading] = useState<boolean>(false);

    const onNewGame: () => void = useCallback(async () => {
        setLoading(true);
        try {
            if (!equilibrateIsReady) {
                //TODO replace with toast or auto-signin
                alert("SDK not ready.");

            } else {
                try {
                    //TODO new game modal
                    await equilibrate.request()
                        .setEntryFeeTokens(0.1)
                        .setMint(NATIVE_MINT)
                        .setSpillRate(0.0001)
                        .setNumberOfBuckets(3)
                        .setMaxPlayers(5)
                        // this sets the game address before the game is made, allowing
                        // us to observe the game creation event
                        .withCreateNewGame(props.setGame)
                        .signAndSend();

                } catch (e) {
                    //TODO better UX
                    console.trace(e);
                }
            }

        } finally {
            setLoading(false);
        }
    }, [equilibrate, equilibrateIsReady]);

    return <Button onClick={ onNewGame }>{ loading ? <Loader/> : "New Game" }</Button>;
}


interface GameCardProps {
    entry: GamesListEntry;
    setGame: SetGameFunction;
    selected: boolean;
}


// https://ui.mantine.dev/category/article-cards
function GameCard(props: GameCardProps): JSX.Element {
    const { classes } = useStyles();

    const userIsPlaying: boolean | undefined = props.entry.userIsPlaying;
    const gameConfig: GameConfigEnriched = props.entry.account.config;
    const buckets: Bucket[] = props.entry.account.state.buckets;

    const totalTokensWithoutDecimals: number = useMemo(() => {
        let result: number = buckets.reduce((sum, bucket) => sum + bucket.decimalTokens.toNumber(), 0);
        if (gameConfig.mintDecimals !== null) {
            result /= Math.pow(10, gameConfig.mintDecimals);
        }
        return result;
    }, [props.entry, buckets]);

    return (
        <button className="game-card-button" onClick={() => props.setGame(props.entry.publicKey)}>
            <Card
                withBorder
                radius="md"
                p={0}
                className={`${classes.card} ${props.selected && classes["card-selected"]}`}
            >
                <Group noWrap spacing={0}>
                    <Image
                        src={"https://www.petakids.com/wp-content/uploads/2015/11/Cute-Red-Bunny.jpg"}
                        height="10vh"
                        width="10vh"
                    />
                    <div className={classes.body}>
                        <Text transform="uppercase" color="dimmed" weight={700} size="xs">
                            { props.entry.account.id.toNumber() }
                        </Text>
                        <Text
                            className={classes.title}
                            mt="xs"
                            mb="md"
                            title={`Prize pool is ${totalTokensWithoutDecimals} tokens`}
                        >
                            {`🪙 ${totalTokensWithoutDecimals}`}
                        </Text>
                        <Group noWrap spacing="xs">
                            <Group spacing="xs" noWrap>
                                <Text size="xs">{`👥 ${buckets[0].players} / ${gameConfig.maxPlayers}`}</Text>
                                {
                                    userIsPlaying && <Text size="xs" title="You're in this game">🥊</Text>
                                }
                                {
                                    (userIsPlaying === undefined) && (
                                        <Text size="xs" title="Unsure if you're in this game">❔</Text>
                                    )
                                }
                            </Group>
                        </Group>
                    </div>
                </Group>
            </Card>
        </button>
    );
}


//TODO move elsewhere
function ClusterControl(): JSX.Element {
    const { key: endpoint, setEndpoint } = useEndpoint();

    return <Group position="center" my="xl">
        <SegmentedControl
            value={endpoint}
            onChange={(value: string) => setEndpoint(value as Endpoint)}
            data={[
                {
                    value: "local",
                    label: (
                        <Center>local</Center>
                    ),
                },
                {
                    value: "dev",
                    label: (
                        <Center>dev</Center>
                    ),
                },
                {
                    value: "main",
                    label: (
                        <Center>main</Center>
                    ),
                },
            ]}
        />
    </Group>;
}


//TODO move to a devtools section
function AirdropButton(): JSX.Element {
    const wallet = useAnchorWallet();
    const { connection } = useConnection();
    const { key: endpoint, isProd: endpointIsProd } = useEndpoint();
    const [loading, setLoading] = useState<boolean>(false);

    const onAirdrop: () => Promise<void> = useCallback(async () => {
        setLoading(true);
        if (endpointIsProd) {
            alert("Airdrop only allowed on local and devnet.");

        } else if (wallet === undefined) {
            alert("Connect wallet first.");

        } else {
            try {
                const transactionId: string = await connection.requestAirdrop(wallet?.publicKey, 1*LAMPORTS_PER_SOL);
                const blockhash = await connection.getLatestBlockhash();
                await connection.confirmTransaction({...blockhash, signature: transactionId}, "finalized");
                console.log("Success! New balance: ", await connection.getBalance(wallet.publicKey));

            } finally {
                setLoading(false);
            }
        }
        setLoading(false);
    }, [endpoint, wallet, connection]);


    return <Button onClick={ onAirdrop } disabled={loading}>{loading ? <Loader/> : "Airdrop"}</Button>;
}
