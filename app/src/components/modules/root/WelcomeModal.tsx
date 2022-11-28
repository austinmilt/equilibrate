import { Button, Group, List, Modal, SimpleGrid, Text } from "@mantine/core";
import { useMemo } from "react";
import { useLocalStorageParam, UseLocalStorageParamContext } from "../../../lib/shared/local-storage";
import { Carousel } from "../../shared/model/carousel";
import GettingStartedImage from "./assets/getting-started.png";
import MoveOrbitImage from "./assets/move-orbit.png";
import EscapeImage from "./assets/escape.png";
import Dynamics1Image from "./assets/dynamics-1.png";
import Dynamics2Image from "./assets/dynamics-2.png";
import Dynamics3Image from "./assets/dynamics-3.png";
import Dynamics4Image from "./assets/dynamics-4.png";
import Dynamics5Image from "./assets/dynamics-5.png";

type WelcomeModalShowValue = "never" | "read" | "unread";


export function useShowWelcome(): UseLocalStorageParamContext<WelcomeModalShowValue> {
    return useLocalStorageParam<WelcomeModalShowValue>("show-welcome");
}


export function WelcomeModal(): JSX.Element {
    const {initialized, value, set} = useShowWelcome();

    const show: boolean = useMemo(() =>
        initialized && (
            value === null ||
            value === "unread"
        ),
    [initialized, value]);

    return (
        <WelcomeModalControlled
            open={show}
            onCloseIntent={() => set("read")}
            onCloseForeverIntent={() => set("never")}

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
                Escape the Solfied through the wormhole with precious hydrogen.
                Be strategic, because your bounty is only as big as your
                claim on the star you orbit.
            </Text>
            <Carousel>
                <Carousel.Item>
                    <div style={{display: "flex", flexDirection: "column"}}>
                        <img src={GettingStartedImage} alt="getting-started" width="100%" style={{margin: "1rem"}}/>
                        Connect your wallet and then enter or create a game.
                        <List>
                            <List.Item>
                                New Game: Click the New Game button and follow instructions.
                                You will be entered into the game automatically.
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
                        Once in the game, click a star to move your ship there.
                    </div>
                </Carousel.Item>
                <Carousel.Item>
                    <div style={{display: "flex", flexDirection: "column"}}>
                        <img src={EscapeImage} alt="escape" width="100%" style={{margin: "1rem"}}/>
                        <List>
                            <List.Item>
                                Your winnings depend on the amount of hydrogen in
                                and players around your star. If you exited a
                                SOL-based game while orbiting a star with 10 ships
                                and 10 SOL (10 billion hydrogen),
                                you would receive 1 SOL.
                            </List.Item>
                            <List.Item>
                                The last player to leave receives all the remaining
                                hydrogen in the system and the game ends.
                            </List.Item>
                            <List.Item>
                                Click the wormhole to escape the system and claim your winnings.
                            </List.Item>
                        </List>
                        <Text size="sm" color="dimmed">
                            That is all you need to know to get started. Continue clicking
                            through slides to learn more about game mechanics.
                        </Text>
                    </div>
                </Carousel.Item>
                <Carousel.Item>
                    <div style={{display: "flex", flexDirection: "column"}}>
                        <img src={Dynamics1Image} alt="dynamics-1" width="100%" style={{margin: "1rem"}}/>
                        The game entry fee* is initially added to the wormhole.
                        <Text size="sm" color="dimmed">
                            *There are additional fees for creating your game
                            account (~0.001 SOL) and payment to the Solfield owner (0.07 SOL).
                        </Text>
                    </div>
                </Carousel.Item>
                <Carousel.Item>
                    <div style={{display: "flex", flexDirection: "column"}}>
                        <img src={Dynamics2Image} alt="dynamics-1" width="100%" style={{margin: "1rem"}}/>
                        In Solfied, tokens are represented by hydrogen.
                        For instance, 1 SOL = 1 billion lamports = 1 billion hydrogen.
                        The size of a star reflects the amount of hydrogen in the star.
                    </div>
                </Carousel.Item>
                <Carousel.Item>
                    <div style={{display: "flex", flexDirection: "column"}}>
                        <img src={Dynamics3Image} alt="dynamics-1" width="100%" style={{margin: "1rem"}}/>
                        Players are represented by ships.
                    </div>
                </Carousel.Item>
                <Carousel.Item>
                    <div style={{display: "flex", flexDirection: "column"}}>
                        <img src={Dynamics4Image} alt="dynamics-2" width="100%" style={{margin: "1rem"}}/>
                        Hydrogen continuously escapes from the wormhole
                        and is equally distributed across the stars.
                    </div>
                </Carousel.Item>
                <Carousel.Item>
                    <div style={{display: "flex", flexDirection: "column"}}>
                        <img src={Dynamics5Image} alt="dynamics-3" width="100%" style={{margin: "1rem"}}/>
                        Hydrogen also escapes from each star and is equally distributed
                        to other stars with fewer orbiting ships.
                        <Text size="sm" color="dimmed">
                            The rate at which hydrogen escapes a star is directly proportional to the number
                            of ships orbiting it. More ships = faster loss.
                        </Text>
                    </div>
                </Carousel.Item>
            </Carousel>
            <Group spacing="sm" position="right">
                <Button onClick={() => props.onCloseForeverIntent()}>Don&apos;t show me this again</Button>
                <Button onClick={() => props.onCloseIntent()}>Got it!</Button>
            </Group>
        </SimpleGrid>
    </Modal>;
}
