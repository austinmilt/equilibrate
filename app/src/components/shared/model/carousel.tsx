import { useState } from "react";
import styles from "./styles.module.css";

export function Carousel(props: {children: JSX.Element[]}): JSX.Element {
    const [iCurrent, setICurrent] = useState<number>(0);

    return (
        <div style={{
            height: "100%",
            display: "flex",
            flexDirection: "row",
            flexWrap: "nowrap",
            alignItems: "center",
            gap: "1rem"
        }}>
            <button
                className={`${styles["carousel-button"]} ${iCurrent === 0 && styles["hidden"]}`}
                onClick={() => setICurrent(Math.max(0, iCurrent - 1))}
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    // stroke="currentColor"
                    stroke="gray"
                    height="3rem"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
            </button>

            {props.children[iCurrent]}

            <button
                className={`${styles["carousel-button"]} ${iCurrent === props.children.length - 1 && styles["hidden"]}`}
                onClick={() => setICurrent(Math.min(props.children.length - 1, iCurrent + 1))}
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    // stroke="currentColor"
                    stroke="gray"
                    height="3rem"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
            </button>
        </div>
    );
}

function CarouselItem(props: { children: React.ReactNode }): JSX.Element {
    return (
        <div style={{
            display: "flex",
            width: "100%",
            height: "100%",
        }}>
            {props.children}
        </div>
    );
}
Carousel.Item = CarouselItem;
