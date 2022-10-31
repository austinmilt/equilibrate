import {
    createContext,
    ReactNode,
    useContext,
    useEffect,
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
    player: PublicKey | undefined;
}

export const EquilibrateProgramContext = createContext<EquilibrateProgramContextState>(
    {} as EquilibrateProgramContextState
);

export function useEquilibrate(): EquilibrateProgramContextState {
    return useContext(EquilibrateProgramContext);
}

export function EquilibrateProgramProvider(props: { children: ReactNode }): JSX.Element {
    const [sdk, setSdk] = useState<EquilibrateSDK>(EquilibrateSDK.dummy());
    const anchorWallet = useAnchorWallet();
    const { connection } = useConnection();

    useEffect(() => {
        if (anchorWallet != null) {
            const provider = new anchor.AnchorProvider(
                connection,
                anchorWallet,
                anchor.AnchorProvider.defaultOptions()
            );
            const program: anchor.Program<Equilibrate> = new anchor.Program(
                IDL as unknown as Equilibrate,
                PROGRAM_ID,
                provider
            );
            setSdk(EquilibrateSDK.from(program));
        }
    }, [anchorWallet, connection, setSdk]);

    const value: EquilibrateProgramContextState = {
        equilibrate: sdk,
        equilibrateIsReady: sdk.isReady(),
        player: anchorWallet?.publicKey
    };

    return (
        <EquilibrateProgramContext.Provider value={value}>
            {props.children}
        </EquilibrateProgramContext.Provider>
    );
}
