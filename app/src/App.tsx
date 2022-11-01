import "./App.css";
import { MantineProvider } from "@mantine/core";
import { EquilibrateProgramProvider } from "./lib/equilibrate/provider";
import { EndpointProvider, SolanaProvider } from "./lib/solana/provider";
import { GamesPanel } from "./components/modules/sidebar/GamesPanel";
import { Viewport } from "./components/modules/viewport/Viewport";
import { ActiveGameProvider } from "./components/shared/game/provider";

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
