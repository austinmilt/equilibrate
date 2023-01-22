import { Center, Group, Loader, SegmentedControl, Text } from "@mantine/core";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl, Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { RPC_URL_LOCAL } from "../../../lib/shared/constants";
import { notifyError, notifyPotentialBug, notifySuccess, notifyWarning } from "../../../lib/shared/notifications";
import { useOnClickOutside } from "../../../lib/shared/useOnClickOutside";
import { useOnEscape } from "../../../lib/shared/useOnEscape";
import { useEndpoint, Endpoint } from "../../../lib/solana/provider";
import { Button, ContainerButton } from "../../shared/model/button";
import { useShowWelcome } from "../root/WelcomeModal";
import styles from "./styles.module.css";

export function SettingsMenu(): JSX.Element {
    const { isProd: endpointIsProd } = useEndpoint();
    const [openMenu, setOpenMenu] = useState<boolean>(false);
    const menuContentRef = useRef<HTMLDivElement>(null);
    const menuButtonRef = useRef<HTMLButtonElement>(null);
    useOnEscape(() => setOpenMenu(false));
    useOnClickOutside([menuContentRef, menuButtonRef], () => setOpenMenu(false));
    const walletBalanceContext = useWalletBalance();

    return <>
        <div className={styles["settings-menu-container"]}>
            <SettingsButton onClick={() => setOpenMenu(!openMenu)} innerRef={menuButtonRef}/>
            { openMenu && (
                <menu className={styles["settings-menu-content"]} ref={menuContentRef}>
                    <div>
                        <WalletMultiButton className={styles["wallet-connect-button"]}/>
                        <div className={styles["wallet-balance"]}>
                            <Text>{ walletBalanceContext.balance?.toFixed(3) } SOL</Text>
                            <ContainerButton onClick={walletBalanceContext.refresh}>
                                <RefreshIcon/>
                            </ContainerButton>
                        </div>
                    </div>
                    <ClusterControl/>
                    { !endpointIsProd && <AirdropButton/> }

                    <HowToPlayButton onClick={() => setOpenMenu(false)}/>

                    <a
                        href="https://github.com/austinmilt/equilibrate"
                        target="_blank"
                        rel="noreferrer"
                    >
                        View source code
                    </a>

                    <a
                        href="https://discord.gg/Ab4ecFXZGU"
                        target="_blank"
                        rel="noreferrer"
                    >
                        Join Discord
                    </a>
                </menu>
            )}
        </div>
    </>;
}


interface UseWalletBalanceContext {
    loading: boolean;
    balance: number | undefined;
    refresh: () => void;
}


function useWalletBalance(): UseWalletBalanceContext {
    const [balance, setBalance] = useState<number | undefined>();
    const [loading, setLoading] = useState<boolean>(false);
    const { connection } = useConnection();
    const wallet = useAnchorWallet();

    const updateBalance: () => void = useCallback(() => {
        if (wallet !== undefined) {
            setLoading(true);
            connection.getBalance(wallet.publicKey)
                .then(b => setBalance(b / LAMPORTS_PER_SOL))
                .catch(e => notifyError("Unable to fetch wallet balance.", e))
                .finally(() => setLoading(false));
        }
    }, [connection, setBalance, wallet]);

    useEffect(updateBalance, [updateBalance]);

    return {
        loading: loading,
        balance: balance,
        refresh: updateBalance
    };
}


function RefreshIcon(): JSX.Element {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className={styles["settings-menu-button"]}
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                // eslint-disable-next-line max-len
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
            />
        </svg>
    );
}


interface SettingsButtonProps {
    onClick: () => void;
    innerRef: React.RefObject<HTMLButtonElement>
}


function SettingsButton(props: SettingsButtonProps): JSX.Element {
    return (
        <ContainerButton onClick={props.onClick} innerRef={props.innerRef}>
            <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className={styles["settings-menu-button"]}
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                />
            </svg>

        </ContainerButton>
    );
}


function ClusterControl(): JSX.Element {
    const { key: endpoint, setEndpoint } = useEndpoint();

    return <Group>
        <SegmentedControl
            value={endpoint}
            onChange={(value: string) => setEndpoint(value as Endpoint)}
            classNames={{
                label: styles["cluster-control-label"],
                labelActive: styles["cluster-control-label-active"],
                root: styles["cluster-control"]
            }}
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


export function AirdropButton(): JSX.Element {
    const wallet = useAnchorWallet();
    const { key: endpoint, isProd: endpointIsProd } = useEndpoint();
    const [loading, setLoading] = useState<boolean>(false);

    // have to use the public RPC for airdrops :/
    const airdropEndpoint: string = useMemo(() => {
        if (endpoint === "local") return RPC_URL_LOCAL;
        else if (endpoint === "dev") return clusterApiUrl("devnet");
        else return "";
    }, [endpoint]);

    const connection: Connection = useMemo(() => new Connection(airdropEndpoint), [airdropEndpoint]);

    const onAirdrop: () => Promise<void> = useCallback(async () => {
        setLoading(true);
        if (endpointIsProd) {
            notifyPotentialBug("Airdrop only allowed on local and devnet.");

        } else if (wallet === undefined) {
            notifyWarning("No wallet connected.", "You must connect a wallet to use this.");

        } else {
            try {
                const transactionId: string = await connection.requestAirdrop(wallet.publicKey, 2*LAMPORTS_PER_SOL);
                const blockhash = await connection.getLatestBlockhash();
                await connection.confirmTransaction({...blockhash, signature: transactionId}, "finalized");
                const newSol: number = (await connection.getBalance(wallet.publicKey)) / LAMPORTS_PER_SOL;
                notifySuccess(
                    "Airdrop suceeded!",
                    `New balance on ${wallet.publicKey.toBase58()} is ${newSol.toFixed(3)} SOL.`
                );
            } catch (e) {
                notifyError("Airdrop failed.", e as Error);

            } finally {
                setLoading(false);
            }
        }
        setLoading(false);
    }, [endpoint, wallet, connection]);


    return (
        <Button onClick={ onAirdrop } disabled={loading}>
            {loading ? <Loader/> : "Get 2 devSOL"}
        </Button>
    );
}


function HowToPlayButton(props: {onClick: () => void}): JSX.Element {
    const {set} = useShowWelcome();

    return (
        <Button onClick={ () => {
            set("unread");
            props.onClick();
        } }>
            How to play
        </Button>
    );
}
