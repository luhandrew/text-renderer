import { GlyphData } from "../loader/fontData";
import { Point } from "../models/Point";
import { Vector2 } from "../models/Vector2";

export const createContoursWithImpliedPoints = (glyph: GlyphData, scale: number = 1): Vector2[][] => {
    let contourStart: number = 0
    let contours: Array<Vector2[]> = []
    glyph.endPtsOfContours.forEach((contourEnd) => {
        let originalContour: Array<Point> = glyph.points.slice(contourStart, contourEnd + 1);

        /* -- Get index of first on curve point -- */
        let pointOffset
        for (pointOffset = 0; pointOffset < originalContour.length; pointOffset++) {
            if (originalContour[pointOffset].onCurve) {
                break;
            }
        }

        /* -- Create the new contour containing the implied points -- */
        let newContour: Array<Vector2> = []
        for (let i = 0; i <= originalContour.length; i++) {
            let curr = originalContour[(i + pointOffset + 0) % originalContour.length]
            let next = originalContour[(i + pointOffset + 1) % originalContour.length]
            newContour.push(new Vector2(curr.x * scale, curr.y * scale))

            if (curr.onCurve == next.onCurve && i < originalContour.length) {
                let midpoint = new Vector2((curr.x + next.x) / 2 * scale, (curr.y + next.y) / 2 * scale)
                newContour.push(midpoint)
            }
        }
        contours.push(newContour)
        contourStart = contourEnd + 1
    })
    return contours
}