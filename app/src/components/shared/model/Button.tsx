import { Button as MantineButton } from "@mantine/core"

interface Props {
    onClick: () => void;
    disabled?: boolean;
    children?: React.ReactNode;
}

// https://mantine.dev/styles/styles-api/
export function Button(props: Props): JSX.Element {
    return (
        <MantineButton
            onClick={props.onClick}
            disabled={props.disabled}
            classNames={{root: "button-like"}}
        >
            {props.children}
        </MantineButton>
    )
}
