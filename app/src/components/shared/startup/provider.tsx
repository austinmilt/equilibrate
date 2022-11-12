import { createContext, ReactNode } from "react";
import { useLoadMintList } from "../../../lib/shared/mint-list";

interface StartupContextState {
    /**
     * Will be `true` when all startup tasks have completed.
     */
    initialized: boolean;
}


const StartupContext = createContext<StartupContextState>(
    {} as StartupContextState
);


/**
 * Wraps startup tasks with app-wide or app startup tasks.
 *
 * @param props
 * @returns
 */
export function StartupProvider(props: { children: ReactNode }): JSX.Element {
    const mintListReady: boolean = useLoadMintList();

    return (
        <StartupContext.Provider value={{initialized: mintListReady}}>
            {props.children}
        </StartupContext.Provider>
    );
}
