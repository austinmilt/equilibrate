import { PublicKey } from "@solana/web3.js";
import { createContext, ReactNode, useContext, useState } from "react";
export interface ActiveGameContextState {
    address: PublicKey | undefined;
    set: (address: PublicKey | undefined) => void;
}


export const ActiveGameContext = createContext<ActiveGameContextState>(
    {} as ActiveGameContextState
);


export function useActiveGame(): ActiveGameContextState {
    return useContext(ActiveGameContext);
}


export function ActiveGameProvider(props: { children: ReactNode }): JSX.Element {
    const [activeGame, setActiveGame] = useState<ActiveGameContextState["address"]>();

    return (
        <ActiveGameContext.Provider value={{
            address: activeGame,
            set: setActiveGame,
        }}>
            {props.children}
        </ActiveGameContext.Provider>
    );
}
