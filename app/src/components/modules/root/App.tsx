import { MantineProvider } from "@mantine/core";
import { NotificationsProvider } from "@mantine/notifications";
import { EquilibrateProgramProvider } from "../../../lib/equilibrate/provider";
import { EndpointProvider, SolanaProvider } from "../../../lib/solana/provider";
import { ActiveGameProvider } from "../../shared/game/provider";
import { LocalStorageProvider } from "../../shared/localStorage/provider";
import { GamesPanel } from "../sidebar/GamesPanel";
import { Viewport } from "../viewport/Viewport";
import "./App.css";
import { WelcomeModal } from "./WelcomeModal";

export default function App(): JSX.Element {
    return (
        <LocalStorageProvider>
            <MantineProvider
                withGlobalStyles
                withNormalizeCSS
                withCSSVariables
                theme={{
                    colorScheme: "dark"
                }}
            >
                <NotificationsProvider>
                    <EndpointProvider>
                        <SolanaProvider>
                            <EquilibrateProgramProvider>
                                <ActiveGameProvider>
                                    <main className="main">
                                        <GamesPanel/>
                                        <Viewport/>
                                        <WelcomeModal/>
                                    </main>
                                </ActiveGameProvider>
                            </EquilibrateProgramProvider>
                        </SolanaProvider>
                    </EndpointProvider>
                </NotificationsProvider>
            </MantineProvider>
        </LocalStorageProvider>
    );
}
