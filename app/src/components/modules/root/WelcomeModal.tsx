import { Button, Group, Modal, SimpleGrid, Text } from "@mantine/core";
import { useMemo } from "react";
import { useLocalStorageParam, UseLocalStorageParamContext } from "../../../lib/shared/local-storage";
import { Carousel } from "../../shared/model/carousel";
import BoringGameDescriptionImage from "./assets/boring-tutorial-game-description.png";
import BoringGameListImage from "./assets/boring-tutorial-game-list.png";

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
                    <div style={{display: "flex", flexDirection: "column"}}>
                        Welcome to B*cket! Collect as much as you can by
                        strategically choosing which bucket to occupy and
                        when you leave.
                        <br/><br/>
                        <Text color="dimmed">Click through the slides to keep learning.</Text>

                    </div>
                </Carousel.Item>
                <Carousel.Item>
                    <div style={{display: "flex", flexDirection: "column"}}>
                        <img src={BoringGameDescriptionImage} alt="tutorial" width="100%" style={{margin: "1rem"}}/>
                        Games are composed of buckets and players. Each bucket
                        contains tokens - represented by the height of the bar - and
                        players - represented by the number of divisions in the bar.
                        <br/><br/>
                        Each bucket has a hole from which tokens leak out and
                        into other buckets. The more players in the bucket,
                        the bigger the hole, and the faster the leak.
                        <br/><br/>
                        Players&apos; initial deposits flow from the faucet
                        to the buckets.
                        <br/><br/>
                        <Text color="dimmed">Click through the slides to keep learning.</Text>
                    </div>
                </Carousel.Item>
                <Carousel.Item>
                    <div style={{display: "flex", flexDirection: "column"}}>
                        <img src={BoringGameDescriptionImage} alt="tutorial" width="100%" style={{margin: "1rem"}}/>
                        Maximize your tokens by leaving the game when the bucket
                        you occupy has a lot of tokens and few players.
                        <br/><br/>
                        And that&apos;s it! To get started, click a game from
                        the list and a bucket to enter, or start a new game.
                        <br/><br/>
                        <Text color="dimmed">Click through the slides to keep learning.</Text>
                    </div>
                </Carousel.Item>
                <Carousel.Item>
                    <div style={{display: "flex", flexDirection: "column"}}>
                        <img src={BoringGameListImage} alt="tutorial" width="100%" style={{margin: "1rem"}}/>
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
