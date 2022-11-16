import { Accordion, Button, Group, List, Modal, SimpleGrid, Text } from "@mantine/core";
import { useEffect, useMemo } from "react";
import { useLocalStorageParam } from "../../../lib/shared/local-storage";


export function WelcomeModal(): JSX.Element {
    const showWelcomeContext = useLocalStorageParam<"never" | "read" | "unread">("show-welcome");

    // on initial load of the app, check if the local storage state
    // was one which should cause the modal to be displayed when they re-open
    useEffect(() => {
        if (showWelcomeContext.initialized && (showWelcomeContext.value === "read")) {
            showWelcomeContext.set("unread");
        }
    }, [showWelcomeContext.initialized]);

    const show: boolean = useMemo(() =>
        showWelcomeContext.initialized && (
            showWelcomeContext.value === null ||
            showWelcomeContext.value === "unread"
        ),
    [showWelcomeContext.initialized, showWelcomeContext.value]);

    return (
        <WelcomeModalControlled
            open={show}
            onCloseIntent={() => showWelcomeContext.set("read")}
            onCloseForeverIntent={() => showWelcomeContext.set("never")}

        />
    );
}



interface Props {
    open: boolean;
    onCloseIntent: () => void;
    onCloseForeverIntent: () => void;
}


export function WelcomeModalControlled(props: Props): JSX.Element {
    return <Modal
        opened={props.open}
        onClose={props.onCloseIntent}
        size="lg"
        title="Welcome to Solfield!"
        centered={true}
        closeOnClickOutside={true}
    >
        <SimpleGrid cols={1}>
            <Text>
                Find yourself in a mysterious starfield where
                stars feed off the hydrogen escaping the wormhole
                you exited. With empty tanks, your only hope is to
                siphon hydrogen off one of the stars. Be strategic, because your
                bounty is only as big as your claim on the star you orbit.
            </Text>
            <Accordion>
                <Accordion.Item value="getting-started">
                    <Accordion.Control>How to play</Accordion.Control>
                    <Accordion.Panel>
                        <List>
                            <List.Item>
                                Enter a game or create a new one (you&apos;ll need to
                                connect a wallet first).
                                <List>
                                    <List.Item>
                                        New Game: Click the New Game button,
                                        fill out the form, and approve the transaction. You&apos;ll
                                        be automatically placed orbiting a star.
                                    </List.Item>
                                    <List.Item>
                                        Enter a Game: Select a game from the list, then click
                                        the star you want to orbit, and confirm the transaction.
                                    </List.Item>
                                </List>
                            </List.Item>
                            <List.Item>
                                Once in the game, click any star to move to orbiting that star.
                            </List.Item>
                            <List.Item>
                                Clicking the wormhole escapes the system.
                            </List.Item>
                        </List>
                    </Accordion.Panel>
                </Accordion.Item>
                <Accordion.Item value="mechanics">
                    <Accordion.Control>How it works</Accordion.Control>
                    <Accordion.Panel>
                        <List>
                            <List.Item>
                                Your entry fee is deposited into the wormhole.
                            </List.Item>
                            <List.Item>
                                Hydrogen (decimal-tokens) continuously escapes from every star and the wormhole
                                and is equally distributed across the other stars with fewer orbiting ships.
                                Hydrogen does not enter the wormhole from stars, only new ships.
                            </List.Item>
                            <List.Item>
                                The rate at which hydrogen escapes a star is directly proportional to the number
                                of ships orbiting it. More ships = faster loss.
                            </List.Item>
                            <List.Item>
                                Leaving the game awards you your proportion of the hydrogen in the star you
                                were orbiting. If you exit the game orbiting a star with 10 hydrogen and
                                10 players, you will receive 1 hydrogen in the form of the mint (with decimals)
                                of the game.
                            </List.Item>
                            <List.Item>
                                The last player to leave receives all the remaining hydrogen in the system
                                and the game ends.
                            </List.Item>
                        </List>
                    </Accordion.Panel>
                </Accordion.Item>
            </Accordion>
            <Group spacing="sm" position="right">
                <Button onClick={() => props.onCloseForeverIntent()}>Don&apos;t show me this again</Button>
                <Button onClick={() => props.onCloseIntent()}>Got it!</Button>
            </Group>
        </SimpleGrid>
    </Modal>;
}
