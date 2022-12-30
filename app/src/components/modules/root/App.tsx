import { MantineProvider } from "@mantine/core";
import { NotificationsProvider } from "@mantine/notifications";
import { EquilibrateProgramProvider } from "../../../lib/equilibrate/provider";
import { EndpointProvider, SolanaProvider } from "../../../lib/solana/provider";
import { ActiveGameProvider } from "../../shared/game/provider";
import { Sidebar } from "../sidebar/Sidebar";
import { Viewport } from "../viewport/Viewport2";
import { WelcomeModal } from "./WelcomeModal";
import styles from "./styles.module.css";
import "./root.css";
import { StartupProvider } from "../../shared/startup/provider";

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
            <NotificationsProvider>
                <EndpointProvider>
                    <SolanaProvider>
                        <EquilibrateProgramProvider>
                            <ActiveGameProvider>
                                <StartupProvider>
                                    <main className={styles["main"]}>
                                        <Sidebar/>
                                        <Viewport/>
                                        <WelcomeModal/>
                                    </main>
                                </StartupProvider>
                            </ActiveGameProvider>
                        </EquilibrateProgramProvider>
                    </SolanaProvider>
                </EndpointProvider>
            </NotificationsProvider>
        </MantineProvider>
    );
}
