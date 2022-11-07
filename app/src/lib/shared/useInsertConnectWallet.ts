import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useCallback, useEffect, useState } from "react";

/**
 * Use to insert the wallet connection flow before some action that requires
 * a connected wallet.
 *
 * @returns
 */
export function useInsertConnectWallet(): (onConnected: () => void) => void {
    const wallet = useAnchorWallet();
    const walletModalContext = useWalletModal();
    const [onConnected, setOnConnected] = useState<(() => void) | undefined>();
    const [userConnectingWallet, setUserConnectingWallet] = useState<boolean>(false);

    const openIfNeeded: (onConnected: () => void) => void = useCallback((onConnected) => {
        if ((wallet === undefined) && !walletModalContext.visible) {
            // I dont really understand why I need to wrap the function
            // when setting in state, but it is required. Otherwise the
            // function is called immediately.
            // https://stackoverflow.com/a/55621325/3314063
            setOnConnected(() => onConnected);

            walletModalContext.setVisible(true);
            setUserConnectingWallet(true);

        } else {
            onConnected();
        }
    }, [wallet, walletModalContext, setUserConnectingWallet]);


    useEffect(() => {
        if (!walletModalContext.visible &&
            userConnectingWallet &&
            (onConnected !== undefined) &&
            (wallet !== undefined)
        ) {
            setUserConnectingWallet(false);
            onConnected();
        }
    }, [walletModalContext.visible, wallet]);


    return openIfNeeded;
}
