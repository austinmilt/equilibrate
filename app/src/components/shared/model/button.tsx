import { Button as MantineButton } from "@mantine/core";
import React from "react";
import sharedStyles from "../shared.module.css";
import styles from "./styles.module.css";

interface Props {
    onClick: () => void;
    disabled?: boolean;
    children?: React.ReactNode;
    innerRef?: React.RefObject<HTMLButtonElement>;
}

// https://mantine.dev/styles/styles-api/
export function Button(props: Props): JSX.Element {
    return (
        <MantineButton
            onClick={props.onClick}
            disabled={props.disabled}
            classNames={{root: sharedStyles["button-like"]}}
        >
            {props.children}
        </MantineButton>
    );
}


export function ContainerButton(props: Props): JSX.Element {
    return (
        <button
            ref={props.innerRef}
            onClick={props.onClick}
            disabled={props.disabled}
            className={styles["container-button"]}
        >
            {props.children}
        </button>
    );
}
