import { MantineProvider } from "@mantine/core";
import { EquilibrateProgramProvider } from "./lib/equilibrate/provider";
import { EndpointProvider, SolanaProvider } from "./lib/solana/provider";
import { GamesPanel } from "./components/modules/sidebar/GamesPanel";
import { Viewport } from "./components/modules/viewport/Viewport";
import { ActiveGameProvider } from "./components/shared/game/provider";
import "./App.css";

//TODO greeting text/theme
// "Enter a mysterious starfield where stars feed off of a wormhole. Your ship spent its fuel in the wormhole
// arriving here. You can escape with some of the precious hydrogen that feeds the stars and wormhole, but your
// bounty is only as big as your claim on the star you orbit."

export default function App(): JSX.Element {

    return (
        <MantineProvider
            withGlobalStyles
            withNormalizeCSS
            withCSSVariables
            theme={{
                colorScheme: "dark"
            }}
        >
            <EndpointProvider>
                <SolanaProvider>
                    <EquilibrateProgramProvider>
                        <ActiveGameProvider>
                            <main className="main">
                                <GamesPanel/>
                                <Viewport/>
                            </main>
                        </ActiveGameProvider>
                    </EquilibrateProgramProvider>
                </SolanaProvider>
            </EndpointProvider>
        </MantineProvider>
    );
}
