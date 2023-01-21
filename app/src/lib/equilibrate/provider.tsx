import {
    createContext,
    ReactNode,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import * as anchor from "@project-serum/anchor";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { EquilibrateSDK } from "./sdk";
import { Equilibrate, IDL } from "../../../../target/types/equilibrate";
import { PROGRAM_ID } from "./constants";
import { PublicKey } from "@solana/web3.js";

export interface EquilibrateProgramContextState {
    equilibrate: EquilibrateSDK;
    equilibrateIsReady: boolean;

    /**
     * Game player. Will always be the one provided by the connected wallet.
     */
    player: PublicKey | undefined;

    /**
     * @param payer payer to use in place of wallet from wallet-adapter (e.g. autosign payer)
     * @returns void
     */
    setPayer: (payer: anchor.Wallet) => void;
}

export const EquilibrateProgramContext = createContext<EquilibrateProgramContextState>(
    {} as EquilibrateProgramContextState
);

export function useEquilibrate(): EquilibrateProgramContextState {
    return useContext(EquilibrateProgramContext);
}

export function EquilibrateProgramProvider(props: { children: ReactNode }): JSX.Element {
    const [sdk, setSdk] = useState<EquilibrateSDK>(EquilibrateSDK.dummy());
    const [overridePayer, setOverridePayer] = useState<anchor.Wallet | undefined>();
    const anchorWallet = useAnchorWallet();
    const { connection } = useConnection();

    const payer: anchor.Wallet = useMemo(() => {
        if (overridePayer !== undefined) return overridePayer;
        if (anchorWallet != null) return (anchorWallet as anchor.Wallet);
        // fallback value allows querying the program without having a wallet connected
        return ({} as anchor.Wallet);
    }, [overridePayer, anchorWallet]);

    useEffect(() => {
        const provider: anchor.AnchorProvider = new anchor.AnchorProvider(
            connection,
            payer,
            anchor.AnchorProvider.defaultOptions()
        );
        const program: anchor.Program<Equilibrate> = new anchor.Program(
            IDL as unknown as Equilibrate,
            PROGRAM_ID,
            provider ?? ({} as anchor.AnchorProvider)
        );
        setSdk(EquilibrateSDK.from(program, anchorWallet?.publicKey));
    }, [payer, connection, setSdk]);

    const value: EquilibrateProgramContextState = {
        equilibrate: sdk,
        equilibrateIsReady: sdk.isReady(),
        player: anchorWallet?.publicKey,
        setPayer: setOverridePayer
    };

    return (
        <EquilibrateProgramContext.Provider value={value}>
            {props.children}
        </EquilibrateProgramContext.Provider>
    );
}
