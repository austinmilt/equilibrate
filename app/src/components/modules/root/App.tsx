import { MantineProvider } from "@mantine/core";
import { NotificationsProvider } from "@mantine/notifications";
import { EquilibrateProgramProvider } from "../../../lib/equilibrate/provider";
import { EndpointProvider, SolanaProvider } from "../../../lib/solana/provider";
import { ActiveGameProvider } from "../../shared/game/provider";
import { LocalStorageProvider } from "../../shared/localStorage/provider";
import { Sidebar } from "../sidebar/Sidebar";
import { Viewport } from "../viewport/Viewport";
import { WelcomeModal } from "./WelcomeModal";
import styles from "./styles.module.css";
import "./root.css";

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
                                    <main className={styles["main"]}>
                                        <Sidebar/>
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
