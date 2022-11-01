import Konva from "konva";
import { Circle as CircleNode } from "konva/lib/shapes/Circle";
import { useCallback, useEffect, useRef, useState } from "react";
import { Circle } from "react-konva";

interface Props {
    x: number;
    y: number;
    radius: number;
    fuelChangeRate: number;
    focused: boolean;
    isSource: boolean;
    onClick: () => void;
    onMouseOverChange: (mousedOver: boolean) => void;
}

// https://konvajs.org/api/Konva.Circle.html
export function Star(props: Props): JSX.Element {
    const ref = useRef<CircleNode>(null);
    const [color, setColor] = useState<string>("#ebb729");

    useEffect(() => {
        if (props.isSource) {
            setColor("black");

        } else if (props.fuelChangeRate < 0) {
            setColor("#2f488a");

        } else if (props.fuelChangeRate > 0) {
            setColor("#ebb729");
        }
        // dont change the color if the flow hits 0
    }, [props.fuelChangeRate]);


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
    }, [ref, props.onClick]);


    // https://stackoverflow.com/a/60658604/3314063
    const onMouseEnter: (e: Konva.KonvaEventObject<MouseEvent>) => void = useCallback((e) => {
        props.onMouseOverChange(true);
        const container: HTMLDivElement | undefined = e.target.getStage()?.container();
        if (container !== undefined) {
            container.style.cursor = "pointer";
        }
    }, [ref, props.onMouseOverChange]);


    const onMouseLeave: (e: Konva.KonvaEventObject<MouseEvent>) => void = useCallback((e) => {
        props.onMouseOverChange(false);
        const container: HTMLDivElement | undefined = e.target.getStage()?.container();
        if (container !== undefined) {
            container.style.cursor = "default";
        }
    }, [ref]);


    return <>
        <Circle
            x={props.x}
            y={props.y}
            radius={props.radius + 10}
            fillEnabled={false}
            stroke="#ffefc2"
            strokeEnabled={true}
            strokeWidth={3}
            visible={props.focused}
        />
        <Circle
            ref={ref}
            radius={props.radius}
            x={props.x}
            y={props.y}
            fill={color}
            onClick={onClick}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        />
    </>;
}
