import { Circle as CircleNode } from "konva/lib/shapes/Circle";
import { useCallback, useEffect, useRef, useState } from "react";
import { Circle, Text } from "react-konva";

interface Props {
    x: number;
    y: number;
    radius: number;
    flow: number;
    onClick: () => void;
}

// https://konvajs.org/api/Konva.Circle.html
export function Star(props: Props): JSX.Element {
    const [color, setColor] = useState<string>("#ebb729");
    const ref = useRef<CircleNode>(null);

    useEffect(() => {
        if (props.flow < 0) {
            setColor("#2f488a");

        } else if (props.flow > 0) {
            setColor("#ebb729");
        }
        // dont change the color if the flow hits 0
    }, [props.flow]);


    // pulse
    const onClick: () => void = useCallback(() => {
        if (ref.current === null) return;
        props.onClick();
        const refDefined: CircleNode = ref.current;
        const growBy: number = 10;
        const startingRadius: number = refDefined.radius();
        refDefined.to({
            width: startingRadius*2 + growBy,
            height: startingRadius*2 + growBy,
            duration: 0.05,
            onFinish: () => {
                refDefined.to({
                    width: startingRadius*2,
                    height: startingRadius*2,
                    duration: 0.05
                });
            }
        });
    }, [ref]);


    return <>
        <Circle
            ref={ref}
            radius={props.radius}
            x={props.x}
            y={props.y}
            fill={color}
            onClick={onClick}
        />
        <Text text={`${props.radius.toFixed(0)}`} x={props.x} y={props.y}/>
    </>;
}
