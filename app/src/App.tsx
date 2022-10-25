import "./App.css";
import { MantineProvider, Text } from "@mantine/core";
import { Viewport } from "./viz/Viewport";
import { EquilibrateProgramProvider } from "./lib/equilibrate/provider";
import { SolanaProvider } from "./lib/solana/provider";

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
            <SolanaProvider>
                <EquilibrateProgramProvider>
                    <Text>Welcome to Equilibrate</Text>
                    <Viewport/>
                </EquilibrateProgramProvider>
            </SolanaProvider>
        </MantineProvider>
    );
}