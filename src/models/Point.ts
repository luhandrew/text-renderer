export class Point {
    x: number
    y: number

    onCurve?: boolean

    constructor (x: number, y: number, onCurve?: boolean) {
        this.x = x
        this.y = y

        this.onCurve = onCurve
    }
}