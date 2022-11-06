import { Modal, Button, TextInput, Loader, NumberInput } from "@mantine/core";
import { NATIVE_MINT } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { useCallback, useEffect, useState } from "react";
import { useEquilibrate } from "../../../lib/equilibrate/provider";

interface NewGameModalProps {
    open: boolean;
    onGameAddressResolved: (address: PublicKey) => void;
    onSuccess: () => void;
    onCloseIntent: () => void;
}


// https://mantine.dev/core/modal/
export function NewGameModal(props: NewGameModalProps): JSX.Element {
    const { equilibrate, equilibrateIsReady } = useEquilibrate();
    const [loading, setLoading] = useState<boolean>(false);

    //TODO replace with form validation
    const [mint, setMint] = useState<PublicKey | null>(NATIVE_MINT);
    const [entryFee, setEntryFee] = useState<number | undefined>(0.1);
    const [spillRate, setSpillRate] = useState<number | undefined>(0.0001);
    const [buckets, setBuckets] = useState<number | undefined>(3);
    const [players, setPlayers] = useState<number | undefined>(5);

    const onNewGame: () => void = useCallback(async () => {
        setLoading(true);
        try {
            validateArg(entryFee, "entryFee");
            validateArg(mint, "mint");
            validateArg(spillRate, "spillRate");
            validateArg(buckets, "buckets");
            validateArg(players, "players");

            if (!equilibrateIsReady) {
                //TODO replace with toast or auto-signin
                alert("SDK not ready GUY.");

            } else {
                try {
                    await equilibrate.request()
                        .setEntryFeeTokens(entryFee)
                        .setMint(mint)
                        .setSpillRate(spillRate)
                        .setNumberOfBuckets(buckets)
                        .setMaxPlayers(players)
                        // this sets the game address before the game is made, allowing
                        // us to observe the game creation event
                        .withCreateNewGame(props.onGameAddressResolved)
                        .signAndSend();

                    props.onSuccess();
                    props.onCloseIntent();

                } catch (e) {
                    //TODO better UX
                    console.trace(e);
                }
            }

        } finally {
            setLoading(false);
        }
    }, [
        equilibrate,
        equilibrateIsReady,
        entryFee,
        mint,
        spillRate,
        buckets,
        players,
        props.onGameAddressResolved,
        props.onSuccess
    ]);

    return (
        <Modal
            opened={props.open}
            onClose={props.onCloseIntent}
            closeOnClickOutside={false}
            size="auto"
            title="Create a new game"
        >
            <PubkeyInput label="Mint" defaultValue={NATIVE_MINT} onChange={setMint}/>
            <NumberInput
                value={entryFee}
                label="Entry Fuel (tokens)"
                onChange={setEntryFee}
                min={1e-9}
                precision={9}
                step={0.01}
            />
            <NumberInput
                value={spillRate}
                label="Hydrogen Escape Rate (tokens per player per second)"
                onChange={setSpillRate}
                min={1e-9}
                precision={9}
                step={0.0001}
            />
            <NumberInput
                value={players}
                label="Max Ships (players)"
                onChange={setPlayers}
                min={1}
                max={1000}
                step={1}
                precision={0}
            />
            <NumberInput
                value={buckets}
                label="Number of Stars"
                onChange={setBuckets}
                min={1}
                max={64}
                step={1}
                precision={0}
            />
            <Button onClick={onNewGame}>{ loading ? <Loader/> : "Create Game" }</Button>
        </Modal>
    );
}


function validateArg<T>(arg: T | undefined | null, name: string): asserts arg is NonNullable<T> & void {
    if (arg == null) {
        throw new Error(`${name} is required`);
    }
}


// https://ui.mantine.dev/category/inputs
export function PubkeyInput(props: {
    label: string,
    defaultValue: PublicKey,
    onChange: (value: PublicKey | null) => void
}): JSX.Element {
    const [stringValue, setStringValue] = useState<string>(props.defaultValue.toBase58());
    const [value, setValue] = useState<PublicKey | null>(null);
    const [error, setError] = useState<string | undefined>();

    useEffect(() => {
        try {
            setValue(new PublicKey(stringValue));
            setError(undefined);

        } catch {
            if (value !== null) {
                setValue(null);
                setError("Not a valid PublicKey");
            }
        }
    }, [stringValue]);

    useEffect(() => {
        props.onChange(value);
    }, [value]);

    return <TextInput
        label={props.label}
        value={stringValue}
        error={error}
        onChange={(e) => setStringValue(e.currentTarget.value)}
    />;
}
