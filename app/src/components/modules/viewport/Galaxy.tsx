import { useCallback } from "react";
import { Group } from "react-konva";
import { ActiveGalaxyContextState, useActiveGalaxy } from "../../shared/providers/galaxy";
import { Satellite } from "./Satellite";
import { Star } from "./Star";
import { useComputedStarProps } from "./useComputedStarProps";

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
        activeGalaxyContext.focalStar.onHoverChange(mousedOver);
        if (mousedOver) {
            activeGalaxyContext.focalStar.set(index);
        }
    }, [activeGalaxyContext.focalStar.set, activeGalaxyContext.focalStar.onHoverChange]);

    return <>
        {stars.map((star, iStar) =>
            <Group key={iStar}>
                <Star
                    x={star.x}
                    y={star.y}
                    isSource={iStar === 0}
                    radius={star.radius}
                    fuelChangeRate={star.fuelChangeRate}
                    focused={activeGalaxyContext.focalStar.index === iStar}
                    onClick={() => activeGalaxyContext.focalStar.onClick(iStar)}
                    onMouseOverChange={(mousedOver: boolean) => onStarMousedOverChange(iStar, mousedOver)}
                />
                {(iStar > 0) && Array(activeGalaxyContext.stars?.[iStar].satellites).fill(null).map((_, iSat) => (
                    <Satellite
                        starMaxRadius={starMaxRadius}
                        starRadius={star.radius}
                        starX={star.x}
                        starY={star.y}
                        isPlayer={(iSat === 0) && (iStar === activeGalaxyContext.playerStar.index)}
                        key={`${iStar}-${iSat}`}
                    />
                ))}
            </Group>
        )}
    </>;
}
