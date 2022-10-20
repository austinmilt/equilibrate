import Konva from "konva";
import { useState } from "react";
import { Circle } from "react-konva";

interface Props {
    x: number;
    y: number;
    radius: number;
}

export function Star(props: Props): JSX.Element {
    const [color, setColor] = useState<string>(Konva.Util.getRandomColor());

    return <Circle
        radius={props.radius}
        x={props.x}
        y={props.y}
        stroke={"white"}
        fill={color}
        onClick={() => setColor(Konva.Util.getRandomColor())}
        draggable={true}
    />;
}
