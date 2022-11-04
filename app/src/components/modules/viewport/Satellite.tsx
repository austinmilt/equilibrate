import Konva from "konva";
import { useEffect, useMemo, useState } from "react";
import { Circle, Line } from "react-konva";

export function Satellite(props: {
    starX: number,
    starY: number,
    starRadius: number,
    starMaxRadius: number,
    isPlayer: boolean
}): JSX.Element {

    // draw the conduit behind the star
    const [conduitRef, setConduitRef] = useState<Konva.Line | null>(null);
    useEffect(() => {
        if (conduitRef !== null) {
            conduitRef.setZIndex(-100);
        }
    }, [conduitRef]);

    const xOffsetProp: number = useMemo(() => 2*Math.random() - 1, []);
    const yOffsetProp: number = useMemo(() => 2*Math.random() - 1, []);

    const xOffset: number = useMemo(() =>
        Math.min(props.starMaxRadius, (props.starRadius + 20)*xOffsetProp),
    [props.starMaxRadius, props.starRadius, xOffsetProp]);

    const yOffset: number = useMemo(() =>
        Math.min(props.starMaxRadius, (props.starRadius + 20)*yOffsetProp),
    [props.starMaxRadius, props.starRadius, yOffsetProp]);

    const x: number = useMemo(() => props.starX + xOffset, [xOffset, props.starX]);
    const y: number = useMemo(() => props.starY + yOffset, [yOffset, props.starY]);

    const color: string = useMemo(() => props.isPlayer ? "#D9594C" : "gray", [props.isPlayer]);

    return <>
        <Circle
            x={x}
            y={y}
            radius={3}
            fill={color}
        />
        <Line
            ref={(ref) => setConduitRef(ref)}
            points={[props.starX, props.starY, x, y]}
            stroke={color}
            strokeWidth={1}
        />
    </>;
}
