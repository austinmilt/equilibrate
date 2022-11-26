import { createContext, ReactNode, useEffect } from "react";
import { useLoadMintList } from "../../../lib/shared/mint-list";
import { useShowWelcome } from "../../modules/root/WelcomeModal";

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
    const welcomeModalContext = useShowWelcome();

    // on initial load of the app, check if the local storage state
    // was one which should cause the modal to be displayed when they re-open
    useEffect(() => {
        if (welcomeModalContext.initialized && (welcomeModalContext.value === "read")) {
            welcomeModalContext.set("unread");
        }
    }, [welcomeModalContext.initialized]);

    return (
        <StartupContext.Provider value={{initialized: mintListReady}}>
            {props.children}
        </StartupContext.Provider>
    );
}
