import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
    PhantomWalletAdapter,
    SolflareWalletAdapter,
    TorusWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import React, { createContext, ReactNode, useContext, useMemo } from "react";
import "@solana/wallet-adapter-react-ui/styles.css";
import { RPC_KEY_DEFAULT, RPC_URL_DEV, RPC_URL_LOCAL, RPC_URL_MAIN } from "../shared/constants";
import { useLocalStorageParam } from "../shared/local-storage";

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
    const { value: lsKey, set: setKey } = useLocalStorageParam<Endpoint>("endpoint-key");
    const key: Endpoint = useMemo(() => lsKey ?? RPC_KEY_DEFAULT, [lsKey]);

    const [url, isProd] = useMemo(() => {
        let newUrl: string;
        let newIsProd: boolean;
        if (key === "local") {
            newUrl = RPC_URL_LOCAL;
            newIsProd = false;

        } else if (key === "dev") {
            newUrl = RPC_URL_DEV;
            newIsProd = false;

        } else {
            newUrl = RPC_URL_MAIN;
            newIsProd = true;
        }
        return [newUrl, newIsProd];
    }, [key]);

    return (
        <EndpointContext.Provider value={{key: key, url: url, isProd: isProd, setEndpoint: setKey}}>
            {props.children}
        </EndpointContext.Provider>
    );
}
