import { Accordion, Button, Group, List, Modal, SimpleGrid, Text } from "@mantine/core";
import { useEffect, useMemo } from "react";
import { useLocalStorageParam } from "../../../lib/shared/local-storage";
import { Carousel } from "../../shared/model/carousel";
import GettingStartedImage from "./assets/getting-started.png";
import MoveOrbitImage from "./assets/move-orbit.png";
import EscapeImage from "./assets/escape.png";
import Dynamics1Image from "./assets/dynamics-1.png";
import Dynamics2Image from "./assets/dynamics-2.png";
import Dynamics3Image from "./assets/dynamics-3.png";
import Dynamics4Image from "./assets/dynamics-4.png";
import Dynamics5Image from "./assets/dynamics-5.png";


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
                        <Carousel>
                            <Carousel.Item>
                                <div style={{display: "flex", flexDirection: "column"}}>
                                    <img src={GettingStartedImage} alt="getting-started" width="100%" style={{margin: "1rem"}}/>
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
                                </div>
                            </Carousel.Item>
                            <Carousel.Item>
                                <div style={{display: "flex", flexDirection: "column"}}>
                                    <img src={MoveOrbitImage} alt="move-orbit" width="100%" style={{margin: "1rem"}}/>
                                    Once in the game, click any star to move to orbiting that star.
                                </div>
                            </Carousel.Item>
                            <Carousel.Item>
                                <div style={{display: "flex", flexDirection: "column"}}>
                                    <img src={EscapeImage} alt="escape" width="100%" style={{margin: "1rem"}}/>
                                    Clicking the wormhole escapes the system.
                                </div>
                            </Carousel.Item>
                        </Carousel>
                    </Accordion.Panel>
                </Accordion.Item>
                <Accordion.Item value="mechanics">
                    <Accordion.Control>How it works</Accordion.Control>
                    <Accordion.Panel>
                        <Carousel>
                            <Carousel.Item>
                                <div style={{display: "flex", flexDirection: "column"}}>
                                    <img src={Dynamics1Image} alt="dynamics-1" width="100%" style={{margin: "1rem"}}/>
                                    The game entry fee is initially added to the wormhole at the center of the system.
                                    Note there are additional fees for creating your game
                                    account (~0.001 SOL) and payment to the Solfield owner (0.07 SOL).
                                </div>
                            </Carousel.Item>
                            <Carousel.Item>
                                <div style={{display: "flex", flexDirection: "column"}}>
                                    <img src={Dynamics2Image} alt="dynamics-2" width="100%" style={{margin: "1rem"}}/>
                                    Tokens/hydrogen continuously escapes from the wormhole
                                    and is equally distributed across the stars.
                                    Hydrogen does not enter the wormhole from stars, only new ships/players.
                                </div>
                            </Carousel.Item>
                            <Carousel.Item>
                                <div style={{display: "flex", flexDirection: "column"}}>
                                    <img src={Dynamics3Image} alt="dynamics-3" width="100%" style={{margin: "1rem"}}/>
                                    Hydrogen also escapes from every star and is equally distributed
                                    to other stars with fewer orbiting ships.
                                </div>
                            </Carousel.Item>
                            <Carousel.Item>
                                <div style={{display: "flex", flexDirection: "column"}}>
                                    <img src={Dynamics4Image} alt="dynamics-4" width="100%" style={{margin: "1rem"}}/>
                                    The rate at which hydrogen escapes a star is directly proportional to the number
                                    of ships orbiting it. More ships = faster loss. The wormhole works as though all
                                    players were orbiting it.
                                </div>
                            </Carousel.Item>
                            <Carousel.Item>
                                <div style={{display: "flex", flexDirection: "column"}}>
                                    <img src={Dynamics5Image} alt="dynamics-5" width="100%" style={{margin: "1rem"}}/>
                                    The balance of hydrogen and ships of the focal star is shown in the HUD.
                                    Hover over other parts of the HUD to see more explanations.
                                </div>
                            </Carousel.Item>
                            <Carousel.Item>
                                <div style={{display: "flex", flexDirection: "column"}}>
                                    Leaving the game (by clicking the wormhole) awards you your proportion of the
                                    hydrogen in the star you were orbiting. If you exited a SOL-based game
                                    while orbiting a star with 10 ships and 10 SOL (10 billion hydrogen),
                                    you would receive 1 SOL.
                                </div>
                            </Carousel.Item>
                            <Carousel.Item>
                                <div style={{display: "flex", flexDirection: "column"}}>
                                    The last player to leave receives all the remaining hydrogen in the system
                                    and the game ends.
                                </div>
                            </Carousel.Item>
                        </Carousel>
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
