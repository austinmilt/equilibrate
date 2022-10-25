import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter, TorusWalletAdapter } from "@solana/wallet-adapter-wallets";
import React, { useMemo } from "react";
import { SOLANA_RPC_URL } from "../constants";

export function SolanaProvider(props: {children: React.ReactNode}): JSX.Element {
    const wallets = useMemo(
        () => [
            new PhantomWalletAdapter(),
            new SolflareWalletAdapter(),
            new TorusWalletAdapter(),
        ],
        []
    );

    return <ConnectionProvider endpoint={SOLANA_RPC_URL}>
        <WalletProvider wallets={wallets}>
            <WalletModalProvider >
                {props.children}
            </WalletModalProvider >
        </WalletProvider>
    </ConnectionProvider>;
}
