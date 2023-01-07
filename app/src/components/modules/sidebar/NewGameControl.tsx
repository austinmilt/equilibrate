import { Modal, Loader, NumberInput, Text, Group, Autocomplete, Collapse } from "@mantine/core";
import { NATIVE_MINT } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { forwardRef, useCallback, useEffect, useMemo, useState } from "react";
import { useEquilibrate } from "../../../lib/equilibrate/provider";
import { MintData, useMintList } from "../../../lib/shared/mint-list";
import { Notifications } from "../../../lib/shared/notifications";
import { useMakeTransactionUrl } from "../../../lib/shared/transaction";
import { useInsertConnectWallet } from "../../../lib/shared/useInsertConnectWallet";
import { ActiveGameContextState, useActiveGame } from "../../shared/game/provider";
import { InlineStyles } from "../../shared/inline-styles";
import { Button } from "../../shared/model/button";
import { useShipLogs } from "../hud/ShipLog";
import styles from "./styles.module.css";
import { SOLANA_MINT_NAME } from "../../../lib/shared/constants";
import { themed } from "../../shared/theme";


interface NewGameControlProps {
    onGameAddressResolved: NewGameModalProps["onGameAddressResolved"];
    onSuccess: NewGameModalProps["onSuccess"];
}


export function NewGameControl(props: NewGameControlProps): JSX.Element {
    const [openModal, setOpenModal] = useState<boolean>(false);
    const connectWalletIfNeeded = useInsertConnectWallet();

    const onClickOpenModal: () => void = useCallback(() => {
        // if the user hasnt connected their wallet, make them go
        // through that first and then automatically open the
        // new game modal
        connectWalletIfNeeded(() => setOpenModal(true));
    }, [setOpenModal, connectWalletIfNeeded]);

    return (
        <>
            <NewGameButton onClick={onClickOpenModal}/>
            <NewGameModal
                open={openModal}
                onCloseIntent={() => setOpenModal(false)}
                onGameAddressResolved={props.onGameAddressResolved}
                onSuccess={props.onSuccess}
            />
        </>
    );
}


function NewGameButton(props: { onClick: () => void }): JSX.Element {
    return (
        <button className={styles["new-game-button"]} onClick={props.onClick}>
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                className={styles["new-game-icon"]}
                stroke="currentColor"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4.5v15m7.5-7.5h-15"
                />
            </svg>
        </button>
    );
}


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
    const { address: activeGame }: ActiveGameContextState = useActiveGame();
    const shipLogContext = useShipLogs(activeGame);
    const makeTransactionUrl = useMakeTransactionUrl();
    const [newGameAddress, setNewGameAddress] = useState<PublicKey | undefined>();
    const [newGameTransactionSignature, setNewGameTransactionSignature] = useState<string | undefined>();
    const [showAdvancedSettings, setShowAdvancedSettings] = useState<boolean>(false);

    const [mint, setMint] = useState<PublicKey | null>(NATIVE_MINT);
    const [entryFee, setEntryFee] = useState<number | undefined>(0.1);
    const [spillRatePercent, setSpillRatePercent] = useState<number | undefined>(2);
    const [buckets, setBuckets] = useState<number | undefined>(3);
    const [players, setPlayers] = useState<number | undefined>(5);

    const onNewGame: () => void = useCallback(async () => {
        setLoading(true);

        let spillRate: number | undefined;
        if ((spillRatePercent !== undefined) && (entryFee !== undefined)) {
            spillRate = (spillRatePercent / 100.0) * entryFee;
        }

        try {
            validateArg(entryFee, "entryFee");
            validateArg(mint, "mint");
            validateArg(spillRate, "spillRate");
            validateArg(buckets, "buckets");
            validateArg(players, "players");

            if (!equilibrateIsReady) {
                Notifications.createSdkNotReady();

            } else {
                try {
                    const result = await equilibrate.request()
                        .setEntryFeeTokens(entryFee)
                        .setMint(mint)
                        .setSpillRate(spillRate)
                        .setNumberOfBuckets(buckets)
                        .setMaxPlayers(players)
                        // this sets the game address before the game is made, allowing
                        // us to observe the game creation event
                        .withCreateNewGame((address) => {
                            setNewGameAddress(address);
                            props.onGameAddressResolved(address);
                        })
                        .signAndSend();

                    setNewGameTransactionSignature(result.transactionSignature);
                    props.onSuccess();

                } catch (e) {
                    Notifications.createError(e);
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
        spillRatePercent,
        buckets,
        players,
        props.onGameAddressResolved,
        props.onSuccess
    ]);


    useEffect(() => {
        if ((newGameAddress !== undefined) && (newGameAddress.toBase58() === activeGame?.toBase58())) {

            let url: string | undefined;
            if (newGameTransactionSignature != null) {
                url = makeTransactionUrl(newGameTransactionSignature);
            }

            shipLogContext.record({
                text: "Started a new game.",
                url: url
            });

            setNewGameAddress(undefined);
            setNewGameTransactionSignature(undefined);
            props.onCloseIntent();
        }
    }, [newGameAddress, activeGame]);


    return (
        <Modal
            opened={props.open}
            onClose={props.onCloseIntent}
            closeOnClickOutside={false}
            size="auto"
            title="Create a new game"
            classNames={{
                modal: styles["new-game-modal"],
                header: styles["new-game-modal-header"],
                body: styles["new-game-modal-body"]
            }}
        >
            <MintSelect onMintSelect={setMint}/>
            <NumberInput
                value={entryFee}
                label={themed("Entry fee (tokens)", "Entry Fuel (tokens)")}
                onChange={setEntryFee}
                min={1e-9}
                precision={9}
                step={0.01}
            />
            <NumberInput
                value={players}
                label={themed("Max players", "Max Ships (players)")}
                onChange={setPlayers}
                min={1}
                max={1000}
                step={1}
                precision={0}
            />
            <button
                onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                className={styles["advanced-settings-button"]}
            >
                <Text size="xs">Advanced Settings {showAdvancedSettings ? "▼" : "▲"} </Text>
            </button>
            <Collapse in={showAdvancedSettings}>
                <div className={styles["new-game-modal-body"]}>
                    <NumberInput
                        value={buckets}
                        label={themed("Number of buckets", "Number of Stars")}
                        onChange={setBuckets}
                        min={1}
                        max={5}
                        step={1}
                        precision={0}
                    />
                    <NumberInput
                        value={spillRatePercent}
                        label={
                            <Text>
                                { themed("Token Spill Rate", "Hydrogen Escape Rate") }<br/>
                                (% of entry fee)
                            </Text>
                        }
                        onChange={setSpillRatePercent}
                        min={0.01}
                        precision={2}
                        step={0.5}
                    />
                </div>
            </Collapse>
            <Button onClick={onNewGame}>{ loading ? <Loader/> : "Create Game" }</Button>
        </Modal>
    );
}


function validateArg<T>(arg: T | undefined | null, name: string): asserts arg is NonNullable<T> & void {
    if (arg == null) {
        throw new Error(`${name} is required`);
    }
}


interface AutoCompleteItemProps extends MintData {
    value: string;
}


const AutoCompleteItem = forwardRef<HTMLDivElement, MintData>(
    ({ name, address, ...others }: MintData, ref) => (
        <div ref={ref} {...others}>
            <Group noWrap>
                <div>
                    <Text>{name}</Text>
                    <Text size="xs" color="dimmed">
                        {address}
                    </Text>
                </div>
            </Group>
        </div>
    )
);

AutoCompleteItem.displayName = "AutoCompleteItem";


function MintSelect(props: { onMintSelect: (mint: PublicKey) => void }): JSX.Element {
    const [nameOrAddress, setNameOrAddress] = useState<string>(NATIVE_MINT.toBase58());
    const [lastValidMintAddress, setLastValidMintAddress] = useState<string | undefined>();
    const mintListContext = useMintList();

    const selectItems: AutoCompleteItemProps[] = useMemo(() =>
        mintListContext.mints?.map(mint =>
            ({...mint, value: mint.address})
        ) ?? [],
    [mintListContext.mints]);


    const searchMatch: (searchValue: string, item: AutoCompleteItemProps) => boolean = useCallback(
        (searchValue, item) => {
            const trimmedKey: string = searchValue.trim();
            const lowercaseKey: string = trimmedKey.toLowerCase();
            // give special priority to SOL since it should be the main
            // mint being used, and it's hard to find in the list.
            if ((lowercaseKey === SOLANA_MINT_NAME.toLowerCase())) {
                if (item.name !== SOLANA_MINT_NAME) return false;
                else return true;
            }
            return item.address.includes(trimmedKey) || item.name.toLowerCase().includes(lowercaseKey);
        },
        []
    );


    const mintPubkey: PublicKey | undefined = useMemo(() => {
        try {
            return new PublicKey(nameOrAddress);
        } catch (e) {
            return undefined;
        }
    }, [nameOrAddress]);


    // update the selected mint for the game form and to display more info the user
    useEffect(() => {
        if ((mintPubkey !== undefined) && (nameOrAddress !== lastValidMintAddress)) {
            try {
                setLastValidMintAddress(nameOrAddress);
                props.onMintSelect(mintPubkey);

            } catch(e) {
                // swallow because the user may still be entering a value
            }
        }
    }, [mintPubkey, props.onMintSelect]);


    const description: string | undefined = useMemo(() => {
        let result: string | undefined;
        if (mintPubkey !== undefined) {
            result = selectItems.find(item => item.address === lastValidMintAddress)?.name ?? "Custom Mint";
        }
        return result;
    }, [mintPubkey, lastValidMintAddress]);


    return (
        <Autocomplete
            value={nameOrAddress}
            onChange={setNameOrAddress}
            label="Token Mint Address"
            data={selectItems}
            itemComponent={AutoCompleteItem}
            filter={searchMatch}
            description={description}
            maxDropdownHeight={InlineStyles.MINT_SELECT.dropdownMaxHeightPixels}
        />
    );
}
