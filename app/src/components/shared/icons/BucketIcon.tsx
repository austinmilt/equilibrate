import styles from "./styles.module.css";

interface Props {
    text?: string;
    classNames?: {
        bucket?: string;
        text?: string;
    }
}

export function BucketIcon(props: Props): JSX.Element {
    return (
        <div style={{position: "relative"}}>
            <svg
                viewBox="0 0 70 70"
                xmlns="http://www.w3.org/2000/svg"
                className={props.classNames?.bucket}
            >
                {/*eslint-disable-next-line max-len*/}
                <path d="m63.95 15.786c0 4.006-12.963 7.238-28.949 7.238-15.988 0-28.951-3.232-28.951-7.238l9.65 43.839c0 2.672 8.637 4.826 19.301 4.826 10.662 0 19.299-2.154 19.299-4.826l9.65-43.839z"/>
                {/*eslint-disable-next-line max-len*/}
                <path d="m63.95 12.786c0-4.004-12.963-7.237-28.949-7.237-15.988 0-28.951 3.233-28.951 7.237 0 4.006 12.963 7.238 28.951 7.238 15.986 0 28.949-3.232 28.949-7.238z"/>
            </svg>
            <span className={ `${styles["bucket-icon-text"]} ${props.classNames?.text && props.classNames.text}` }>
                {props.text}
            </span>
        </div>
    );
}
