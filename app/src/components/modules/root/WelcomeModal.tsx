import { Button, Group, Modal, SimpleGrid } from "@mantine/core";
import { useMemo } from "react";
import { useLocalStorageParam, UseLocalStorageParamContext } from "../../../lib/shared/local-storage";
import { Carousel } from "../../shared/model/carousel";
import GalaxyImage from "./assets/galaxy.png";

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
        centered={true}
        closeOnClickOutside={true}
    >
        <SimpleGrid cols={1}>
            <Carousel>
                <Carousel.Item>
                    Welcome to Solfield, a game in which
                    winning depends on your ability to strategically
                    outmaneuver other players and time your escape.
                    <br/><br/>
                    Each Solfield game is a unique galaxy of stars and
                    a wormhole. Tokens, represented by hydrogen, constantly
                    flow out of the wormhole and stars and into other stars.
                    <br/><br/>
                    Your mission is to harvest hydrogen. Maximize your hydrogen
                    by exiting the game while orbiting a star with lots of
                    hydrogen and few players.
                    <br/><br/>
                    And that&apos;s it! To get started, click a game from
                    the list and a star to orbit, or start a new game.
                    You can also click through the slides to learn more
                    about game mechanics.
                </Carousel.Item>
                <Carousel.Item>
                    <div style={{display: "flex", flexDirection: "column"}}>
                        <img src={GalaxyImage} alt="galaxy" width="100%" style={{margin: "1rem"}}/>
                        The size of a star indicates the amount of hydrogen in the star.
                        <br/><br/>
                        Orbit a star by clicking it.
                    </div>
                </Carousel.Item>
                <Carousel.Item>
                    <div style={{display: "flex", flexDirection: "column"}}>
                        <img src={GalaxyImage} alt="galaxy" width="100%" style={{margin: "1rem"}}/>
                        When you enter or create a game, you pay the the game
                        entry fee, which is initially added to the wormhole. There
                        is an additional fee of ~0.07 SOL to create or enter a game.
                        <br/><br/>
                        Tokens are represented by hydrogen. For instance, 1 SOL =
                        1 billion lamports = 1 billion hydrogen.
                    </div>
                </Carousel.Item>
                <Carousel.Item>
                    <div style={{display: "flex", flexDirection: "column"}}>
                        <img src={GalaxyImage} alt="galaxy" width="100%" style={{margin: "1rem"}}/>
                        Hydrogen continuously flows out of the wormhole and is
                        equally distributed across the stars.
                        <br/><br/>
                        Hydrogen also continuously flows out of stars into
                        other stars with fewer orbiting ships.
                        <br/><br/>
                        The rate at which hydrogen flows out of stars is directly
                        proportional to the number of orbiting ships. More ships
                        equals faster flow.
                    </div>
                </Carousel.Item>
                <Carousel.Item>
                    <div style={{display: "flex", flexDirection: "column"}}>
                        <img src={GalaxyImage} alt="galaxy" width="100%" style={{margin: "1rem"}}/>
                        When you leave a game, you receive tokens equal to
                        your proportional claim on the hydrogen in the star
                        you were orbiting. For instance, if you leave a SOL-based
                        game while orbiting a star with 10 billion hydrogen and
                        10 players, you would receive 1 SOL.
                        <br/><br/>
                        The last player to leave receives all the unclaimed
                        tokens in the game. This ends the game.
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
