import { useCallback } from "react";
import { Group } from "react-konva";
import { ActiveGalaxyContextState, useActiveGalaxy } from "../../shared/galaxy/provider";
import { Satellite } from "./Satellite";
import { Star } from "./Star";
import { useComputedStarProps } from "./useComputedStarProps";

// Galaxy is the collection of stars and conduits
export interface GalaxyProps {
    viewportDimensions: {
        widthPixels: number;
        heightPixels: number;
    }
}


export function Galaxy(props: GalaxyProps): JSX.Element {
    const activeGalaxyContext: ActiveGalaxyContextState = useActiveGalaxy();
    const [stars, starMaxRadius] = useComputedStarProps(
        props.viewportDimensions,
        activeGalaxyContext.stars ?? [],
        activeGalaxyContext.galaxy?.constants
    );

    const onStarMousedOverChange: (index: number, mousedOver: boolean) => void = useCallback((index, mousedOver) => {
        if (mousedOver) {
            activeGalaxyContext.focalStar.set(index);
        }
    }, [activeGalaxyContext.focalStar.set]);

    return <>
        {stars.map((star, i) =>
            <Group key={i}>
                <Star
                    x={star.x}
                    y={star.y}
                    isSource={i === 0}
                    radius={star.radius}
                    fuelChangeRate={star.fuelChangeRate}
                    focused={activeGalaxyContext.focalStar.index === i}
                    onClick={() => activeGalaxyContext.focalStar.onClick(i)}
                    onMouseOverChange={(mousedOver: boolean) => onStarMousedOverChange(i, mousedOver)}
                />
                {(i > 0) && Array(activeGalaxyContext.stars?.[i].satellites).fill(null).map(iSat => (
                    <Satellite
                        starMaxRadius={starMaxRadius}
                        starRadius={star.radius}
                        starX={star.x}
                        starY={star.y}
                        key={`${i}-${iSat}`}
                    />
                ))}
            </Group>
        )}
    </>;
}
