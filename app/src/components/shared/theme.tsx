import React from "react";
import { USE_BORING_THEME } from "../../lib/shared/constants";

export function themed<T>(boringThemeOption: T, starThemeOption: T): T {
    return USE_BORING_THEME ? boringThemeOption : starThemeOption;
}

export function Themed(props: { children: React.ReactNode }): JSX.Element {
    return <>{props.children}</>;
}

function BoringThemed(props: { children: React.ReactNode }): JSX.Element {
    return <>{!USE_BORING_THEME ? null : props.children}</>;
}
Themed.Boring = BoringThemed;

function StarThemed(props: { children: React.ReactNode }): JSX.Element {
    return <>{USE_BORING_THEME ? null : props.children}</>;
}
Themed.Star = StarThemed;
