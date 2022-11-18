import { Center, Group, Loader, SegmentedControl } from "@mantine/core";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl, Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useState, useCallback, useRef, useMemo } from "react";
import { RPC_URL_LOCAL } from "../../../lib/shared/constants";
import { notifyPotentialBug, notifySuccess, notifyWarning } from "../../../lib/shared/notifications";
import { useOnClickOutside } from "../../../lib/shared/useOnClickOutside";
import { useOnEscape } from "../../../lib/shared/useOnEscape";
import { useEndpoint, Endpoint } from "../../../lib/solana/provider";
import { Button, ContainerButton } from "../../shared/model/button";
import styles from "./styles.module.css";

export function SettingsMenu(): JSX.Element {
    const { isProd: endpointIsProd } = useEndpoint();
    const [openMenu, setOpenMenu] = useState<boolean>(false);
    const menuContentRef = useRef<HTMLDivElement>(null);
    const menuButtonRef = useRef<HTMLButtonElement>(null);
    useOnEscape(() => setOpenMenu(false));
    useOnClickOutside([menuContentRef, menuButtonRef], () => setOpenMenu(false));

    return <>
        <div className={styles["settings-menu-container"]}>
            <SettingsButton onClick={() => setOpenMenu(!openMenu)} innerRef={menuButtonRef}/>
            { openMenu && (
                <menu className={styles["settings-menu-content"]} ref={menuContentRef}>
                    <WalletMultiButton className={styles["wallet-connect-button"]}/>
                    <ClusterControl/>
                    { !endpointIsProd && <AirdropButton/> }
                </menu>
            )}
        </div>
    </>;
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
                stroke="currentColor"
                className={styles["settings-menu-button"]}
            >
                {/* eslint-disable-next-line max-len */}
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
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


function AirdropButton(): JSX.Element {
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
                const transactionId: string = await connection.requestAirdrop(wallet.publicKey, 1*LAMPORTS_PER_SOL);
                const blockhash = await connection.getLatestBlockhash();
                await connection.confirmTransaction({...blockhash, signature: transactionId}, "finalized");
                const newSol: number = (await connection.getBalance(wallet.publicKey)) / LAMPORTS_PER_SOL;
                notifySuccess(
                    "Airdrop suceeded!",
                    `New balance on ${wallet.publicKey.toBase58()} is ${newSol.toFixed(3)} SOL.`
                );

            } finally {
                setLoading(false);
            }
        }
        setLoading(false);
    }, [endpoint, wallet, connection]);


    return (
        <Button onClick={ onAirdrop } disabled={loading}>
            {loading ? <Loader/> : "Airdrop"}
        </Button>
    );
}
