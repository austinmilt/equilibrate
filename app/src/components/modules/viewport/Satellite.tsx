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

    const [conduitRef, setConduitRef] = useState<Konva.Line | null>(null);
    useEffect(() => {
        if (conduitRef !== null) {
            //TODO want to draw the conduit behind the star, but cant do that unless it's
            // in the same level as the star, so I'll have to rearrange how this stuff is
            // drawn (draw all the conduits before the stars and satellites)

            // pass pointer events through to the star if it's overlapping
            conduitRef.listening(false);
        }
    }, [conduitRef]);

    const [satelliteRef, setSatelliteRef] = useState<Konva.Circle | null>(null);
    useEffect(() => {
        if (satelliteRef !== null) {
            // pass pointer events through to the star if it's overlapping
            satelliteRef.listening(false);
        }
    }, [satelliteRef]);

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

    //TODO export style consts elsewhere
    const color: string = useMemo(() => props.isPlayer ? "#D9594C" : "gray", [props.isPlayer]);

    return <>
        <Circle
            ref={setSatelliteRef}
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
