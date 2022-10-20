import {
    createContext,
    ReactNode,
    useCallback,
    useContext,
    useEffect,
    useReducer,
    useState,
} from "react";
import * as anchor from "@project-serum/anchor";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { EquilibrateSDK } from "./sdk";
import { Equilibrate } from "../../../../target/types/equilibrate";
import IDL from "../../../../target/idl/equilibrate.json";
import { PROGRAM_ID } from "./constants";
import { Game } from "./types";

export interface EquilibrateProgramContextState {
    equilibrate: EquilibrateSDK;
    equilibrateIsReady: boolean;
    watchGame: (gameAddress: PublicKey, callback: (game: Game) => void) => () => void
}

export const EquilibrateProgramContext = createContext<EquilibrateProgramContextState>(
    {} as EquilibrateProgramContextState
);

export function useEquilibrate(): EquilibrateProgramContextState {
    return useContext(EquilibrateProgramContext);
}

export function EquilibrateProgramProvider(props: { children: ReactNode }): JSX.Element {
    const [sdk, setSdk] = useState<EquilibrateSDK>(EquilibrateSDK.dummy());
    const userWallet = useAnchorWallet();
    const { connection } = useConnection();
    const [watchedGames, updateWatchedGames] = useReducer();

    useEffect(() => {
        if (userWallet?.publicKey != null) {
            const provider = new anchor.AnchorProvider(
                connection,
                userWallet,
                anchor.AnchorProvider.defaultOptions()
            );
            const program: anchor.Program<Equilibrate> = new anchor.Program(
                IDL as unknown as Equilibrate,
                PROGRAM_ID,
                provider
            );
            setSdk(EquilibrateSDK.from(program, userWallet.publicKey, userWallet.signTransaction));
        }
    }, [userWallet, connection, setSdk]);

    const watchGame: EquilibrateProgramContextState["watchGame"] = useCallback((gameAddress, callback) => {
        if (!sdk.isReady()) {
            throw new Error("Cannot watch a game until the SDK has been initialized");
        } else {
            sdk.watchGame(gameAddress, callback);
        }
    }, []);

    const value: EquilibrateProgramContextState = {
        equilibrate: sdk,
        equilibrateIsReady: sdk.isReady(),
        watchGame: watchGame,
    };

    return (
        <EquilibrateProgramContext.Provider value={value}>
            {props.children}
        </EquilibrateProgramContext.Provider>
    );
}

interface AnchorEventEmitter {
    addListener: <T>(event: T, callback: )
}

//TODO use the findings from /tests/equilibrate > "watch game" to figure out how
// to correctly subscribe to changes to the game.
//
// Then create a properly typed emitter that has one listener per game being watched
// and adds/removes listeners via the SDK
function watchGameReducer(gameEmitters: {[game: string]: EventEmitter<string | symbol, any>}, action) {
    switch (action.type) {
    case "increment":
        return {count: state.count + 1};
    case "decrement":
        return {count: state.count - 1};
    default:
        throw new Error();
    }
}
