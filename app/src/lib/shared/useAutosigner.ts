import { useAnchorWallet, useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Keypair, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { useCallback, useEffect, useState } from "react";
import { useLocalStorageParam } from "./local-storage";
import { useEquilibrate } from "../equilibrate/provider";
import NodeWallet from "@project-serum/anchor/dist/cjs/nodewallet";
import * as anchor from "@project-serum/anchor";
import { useInsertConnectWallet } from "./useInsertConnectWallet";

const LOCAL_STORAGE_KEY: string = "game-autosigner";


interface AutosignerContext {
    autosign: boolean;
    signer: Keypair | null;
    balance: number | null;
    setAutosign: (autosign: boolean) => void;
    deposit: (amountSol: number) => Promise<string>;
    closeAccount: () => void;
}


export function useAutosigner() {
    const localStorageContext = useLocalStorageParam<AutosignerStorageValue>(LOCAL_STORAGE_KEY);
    const userWallet = useWallet();
    const { connection } = useConnection();
    const { setPayer: setEquilibratePayer } = useEquilibrate();

    // setup on initial load of the app
    useEffect(() => {
        if (localStorageContext.value?.autosign && (localStorageContext.value.signer != null)) {
            const signer: Keypair = Keypair.fromSecretKey(new Uint8Array(localStorageContext.value.signer));
            setEquilibratePayer(new NodeWallet(signer));
        }
    }, [setEquilibratePayer, localStorageContext.value]);


    const setAutosign: AutosignerContext["setAutosign"] = useCallback(newValue => {
        if (localStorageContext.value == null) {
            throw new Error(
                "Tried to set autosign value before the local storage value was ready." +
                " Try depositing SOL first."
            );
        }
        if (localStorageContext.value?.autosign !== newValue) {
            localStorageContext.set({...localStorageContext.value, autosign: newValue});
        }
    }, [localStorageContext.value, localStorageContext.set]);


    const deposit: AutosignerContext["deposit"] = useCallback(async (amountSol) => {
        if (userWallet.publicKey == null) {
            throw new Error("Must connect wallet first.");
        }

        let signer: Keypair;
        if (localStorageContext.value?.signer == null) {
            // create the autosigner wallet if needed
            signer = Keypair.generate();
            setEquilibratePayer(new NodeWallet(signer));

        } else {
            signer = Keypair.fromSecretKey(new Uint8Array(localStorageContext.value.signer));
        }

        const depositInstruction: TransactionInstruction = anchor.web3.SystemProgram.transfer({
            fromPubkey: userWallet.publicKey,
            toPubkey: signer.publicKey,
            lamports: Math.floor(amountSol * anchor.web3.LAMPORTS_PER_SOL)
        });
        const depositSignature: string = await userWallet.sendTransaction(
            new Transaction().add(depositInstruction),
            connection,
            {
                preflightCommitment: "confirmed"
            }
        );

        const newBalance: number = await connection.getBalance(signer.publicKey);
        return depositSignature;
    }, [userWallet, setEquilibratePayer, localStorageContext.value]);
}


interface AutosignerStorageValue {
    autosign: boolean;
    signer: number[] | null;
    balance: number | null;
    owner: string | null;
}
