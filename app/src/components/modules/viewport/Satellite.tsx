import { useMemo } from "react";
import { Circle, Line } from "react-konva";

export function Satellite(props: {starX: number, starY: number, starRadius: number, starMaxRadius: number}): JSX.Element {
    const xOffsetProp: number = useMemo(() => 2*Math.random() - 1, []);
    const yOffsetProp: number = useMemo(() => 2*Math.random() - 1, []);
    const xOffset: number = useMemo(() => Math.min(props.starMaxRadius, (props.starRadius + 20)*xOffsetProp), [props.starMaxRadius, props.starRadius, xOffsetProp]);
    const yOffset: number = useMemo(() => Math.min(props.starMaxRadius, (props.starRadius + 20)*yOffsetProp), [props.starMaxRadius, props.starRadius, yOffsetProp]);
    const x: number = useMemo(() => props.starX + xOffset, [xOffset, props.starX]);
    const y: number = useMemo(() => props.starY + yOffset, [yOffset, props.starY]);
    return <>
        <Circle x={x} y={y} radius={3} fill="gray"/>
        <Line points={[props.starX, props.starY, x, y]} stroke="gray" strokeWidth={1}/>
    </>;
}
