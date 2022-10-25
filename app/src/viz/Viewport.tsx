import { Stage, Layer } from "react-konva";
import { Star } from "./Star";
import "./viewport.css";

export function Viewport(): JSX.Element {
    return (
        <Stage className="stage" width={800} height={600}>
            <Layer>
                {Array(64).fill(null).map((_, i) =>
                    <Star
                        x={Math.round(Math.random()*700) + 50}
                        y={Math.round(Math.random()*500) + 50}
                        radius={Math.round(Math.random()*50)}
                        key={i}
                    />
                )}
            </Layer>
        </Stage>
    );
}
