export const isBitSet = (val: number, bitIndex: number): boolean => {
    return ((val >> bitIndex) & 1) == 1;
}