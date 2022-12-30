import { ActiveGalaxyProvider } from "../../shared/galaxy/provider";
import { GalaxyBoring } from "./GalaxyBoring";
import styles from "./styles.module.css";
import { Hud } from "../hud/Hud";

export function ViewportBoring(): JSX.Element {

    return (
        <section className={styles["viewport"]}>
            <ActiveGalaxyProvider>
                <Hud/>
                <GalaxyBoring/>
            </ActiveGalaxyProvider>
        </section>
    );
}
