import { useCallback, useEffect, useState } from "react";
import { Stage, Layer } from "react-konva";
import { Galaxy, GalaxyProps } from "./Galaxy";
import "./viewport.css";

const width: number = 800;
const height: number = 600;
const starCount: number = 3;

const entryFeeFuel: number = Math.random()*Math.pow(10, 9);
const maxSatellites: number = Math.random()*100;
const maxGalaxyFuel: number = entryFeeFuel*maxSatellites;
const maxFuelChangeRateMagnitute: number = maxGalaxyFuel / ( Math.random() * 20 );

export function Viewport(): JSX.Element {
    //TODO placeholder to be replaced with game status
    const [lastUpdate, setLastUpdate] = useState<number>(new Date().getTime());
    const [stars, setStars] = useState<GalaxyProps["stars"] | undefined>();
    const [interval, setIntervalObj] = useState<NodeJS.Timeout | undefined>();

    useEffect(() => {
        const newStars = Array(starCount + 1)
            .fill(null)
            .map(() => {
                const satellites: number = Math.round(Math.random()*maxSatellites);
                return {
                    fuel: entryFeeFuel*satellites,
                    satellites: satellites,
                    fuelChangeRate: (Math.random() < 0.5 ? -1 : 1) * Math.random()*maxFuelChangeRateMagnitute
                };
            });
        setStars(newStars);
    }, []);

    const updateStars = useCallback(() => {
        if (stars) {
            const now: number = new Date().getTime();
            const deltaTimeSeconds: number = (now - lastUpdate) / 1000;
            const newStars = stars.map(s => {
                const fuel: number = Math.min(maxGalaxyFuel, Math.max(0, s.fuel + s.fuelChangeRate * deltaTimeSeconds));
                let fuelChangeRate: number = s.fuelChangeRate;
                if (fuel <= 0 && fuelChangeRate < 0) fuelChangeRate = 0;
                if (fuel >= maxGalaxyFuel && fuelChangeRate > 0) fuelChangeRate = 0;
                return {
                    satellites: s.satellites,
                    fuel: fuel,
                    fuelChangeRate: fuelChangeRate
                };
            });
            // eslint-disable-next-line max-len
            // console.log("fuel", JSON.stringify(newStars.map(s => `${s.fuel.toFixed(0)} | ${s.fuelChangeRate.toFixed(0)}`), undefined, 2));
            setStars(newStars);
            setLastUpdate(now);
        }
    }, [stars]);

    useEffect(() => {
        if (stars && !interval) {
            setIntervalObj(setInterval(updateStars, 100));
        }
    }, [stars]);

    useEffect(() => {
        if (interval) {
            return () => clearInterval(interval);
        }
    }, []);

    return (
        <div className="viewport">
            <Stage className="stage" width={width} height={height}>
                <Layer>
                    {stars &&
                        <Galaxy
                            stars={stars}
                            viewportDimensions={{widthPixels: width, heightPixels: height}}
                            galaxyConstants={{
                                entryFuel: entryFeeFuel,
                                maxSatellites: maxSatellites
                            }}
                        />
                    }
                </Layer>
            </Stage>
        </div>
    );
}
