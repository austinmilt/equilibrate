import "./App.css";
import { MantineProvider, Text } from "@mantine/core";

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
            <Text>Welcome to Equilibrate</Text>
        </MantineProvider>
    );
}
