import React, { useRef, useCallback } from "react";

type RangeSliderProps = {
    min: number;
    max: number;
    value: [number, number];
    onChange: (value: [number, number]) => void;
    formatLabel?: (val: number) => string;
    step?: number;
};

export const RangeSlider: React.FC<RangeSliderProps> = ({
    min,
    max,
    value,
    onChange,
    formatLabel,
    step = 1
}) => {
    const [minVal, maxVal] = value;
    const range = useRef<HTMLDivElement>(null);

    const getPercent = useCallback(
        (value: number) => Math.round(((value - min) / (max - min)) * 100),
        [min, max]
    );

    return (
        <div className="relative w-full py-6 select-none group">
            <div className="h-2 bg-gray-200 rounded-full w-full relative z-0">
                <div
                    ref={range}
                    className="absolute h-full bg-blue-600 rounded-full z-10 opacity-80"
                    style={{
                        left: `${getPercent(minVal)}%`,
                        width: `${getPercent(maxVal) - getPercent(minVal)}%`
                    }}
                />
            </div>

            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={minVal}
                onChange={(event) => {
                    const value = Math.min(Number(event.target.value), maxVal - step);
                    onChange([value, maxVal]);
                }}
                className="absolute pointer-events-none top-1/2 -translate-y-1/2 w-full h-0 z-20 appearance-none 
        [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 
        [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md 
        [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-gray-300 [&::-webkit-slider-thumb]:cursor-grab 
        [&::-webkit-slider-thumb]:appearance-none active:[&::-webkit-slider-thumb]:cursor-grabbing"
            />
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={maxVal}
                onChange={(event) => {
                    const value = Math.max(Number(event.target.value), minVal + step);
                    onChange([minVal, value]);
                }}
                className="absolute pointer-events-none top-1/2 -translate-y-1/2 w-full h-0 z-30 appearance-none 
        [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 
        [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md 
        [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-gray-300 [&::-webkit-slider-thumb]:cursor-grab 
        [&::-webkit-slider-thumb]:appearance-none active:[&::-webkit-slider-thumb]:cursor-grabbing"
            />

            <div className="relative w-full mt-3">
                <div className="flex justify-between text-xs font-mono font-medium text-gray-500">
                    <span>{formatLabel ? formatLabel(minVal) : minVal}</span>
                    <span>{formatLabel ? formatLabel(maxVal) : maxVal}</span>
                </div>
            </div>
        </div>
    );
};