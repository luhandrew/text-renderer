export const getRangeScale = (minA: number, maxA: number, minB: number, maxB: number) => {
    return (maxA - minA) / (maxB - minB)
}

export const downscaleValue = (value: number, scale: number) => {
    return value / scale
}

export const transformRange = (value: number, minA: number, maxA: number, minB: number, maxB: number) => {
    return value / ((maxA - minA) / (maxB - minB))
}