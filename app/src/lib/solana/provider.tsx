import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
    PhantomWalletAdapter,
    SolflareWalletAdapter,
    TorusWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import React, { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import "@solana/wallet-adapter-react-ui/styles.css";
import { clusterApiUrl } from "@solana/web3.js";
import { SOLANA_RPC_URL } from "../constants";

// https://github.com/solana-labs/wallet-adapter/blob/master/APP.md
export function SolanaProvider(props: {children: React.ReactNode}): JSX.Element {
    const { url: solanaRpcUrl } = useEndpoint();

    const wallets = useMemo(
        () => [
            new PhantomWalletAdapter(),
            new SolflareWalletAdapter(),
            new TorusWalletAdapter(),
        ],
        []
    );

    return <ConnectionProvider endpoint={solanaRpcUrl}>
        <WalletProvider wallets={wallets} autoConnect>
            <WalletModalProvider>
                { props.children }
            </WalletModalProvider>
        </WalletProvider>
    </ConnectionProvider>;
}


export type Endpoint = "local" | "dev" | "main";

export interface EndpointContextState {
    key: Endpoint;
    url: string;
    isProd: boolean;
    setEndpoint: (endpoint: Endpoint) => void;
}

export const EndpointContext = createContext<EndpointContextState>(
    {} as EndpointContextState
);

export function useEndpoint(): EndpointContextState {
    return useContext(EndpointContext);
}

export function EndpointProvider(props: { children: ReactNode }): JSX.Element {
    const [key, setKey] = useState<Endpoint>("local");
    const [url, setUrl] = useState<string>(SOLANA_RPC_URL);
    const [isProd, setIsProd] = useState<boolean>(false);

    useEffect(() => {
        let newUrl: string;
        let newIsProd: boolean;
        if (key === "local") {
            newUrl = "http://localhost:8899";
            newIsProd = false;

        } else if (key === "dev") {
            newUrl = clusterApiUrl("devnet");
            newIsProd = false;

        } else {
            newUrl = clusterApiUrl("mainnet-beta");
            newIsProd = true;
        }
        setUrl(newUrl);
        setIsProd(newIsProd);
    }, [key]);

    return (
        <EndpointContext.Provider value={{key: key, url: url, isProd: isProd, setEndpoint: setKey}}>
            {props.children}
        </EndpointContext.Provider>
    );
}
