import { createContoursWithImpliedPoints } from "../utils/glyphUtils";
import type { FontData, GlyphData } from "../loader/fontData";
import { downscaleValue, getRangeScale, transformRange } from "../utils/mathUtils";
import { SVG, extend as SVGextend, Element as SVGElement, off } from '@svgdotjs/svg.js'

/* using abstract since apparently typescript doesn't support static classes :shrug: */
export class GlyphRenderer {
    fontData: FontData

    cellHeight!: number
    cellWidth!: number

    constructor (fontData: FontData) {
        this.fontData = fontData
    }

    drawGlyph (unicode: number, moreLengthy?: boolean) {
        let data = this.fontData.getGlyph(unicode)
        let contoursWithImpliedPoints = createContoursWithImpliedPoints(data)

        let glyphWidth = (data.maxX - data.minX)
        let wantedWidth = 200
        let downscaleWidth = glyphWidth / wantedWidth
        
        let glyphHeight = (data.maxY - data.minY)
        let wantedHeight = 500
        let downscaleHeight = glyphHeight / wantedHeight

        let maxDownscale = Math.max(downscaleWidth, downscaleHeight)
        this.cellWidth = glyphWidth / maxDownscale
        this.cellHeight = glyphHeight / maxDownscale
        
        let minX = 999999, maxX = 0, minY = 999999, maxY = 0
        contoursWithImpliedPoints.forEach(contourPoints => {
            for (let i = 0; i < contourPoints.length; i++) {
                /* -- taking the maximum one, to ensure that it maintains the right ratio -- */
                contourPoints[i].y = window.innerHeight - contourPoints[i].y
                let scaleX = getRangeScale(data.minX, data.maxX, 10, this.cellWidth - 10)
                let scaleY = getRangeScale(data.minY, data.maxY, 10, this.cellHeight - 10)
                let scale = Math.max(scaleX, scaleY)
                contourPoints[i].x = downscaleValue(contourPoints[i].x, scale)
                contourPoints[i].y = downscaleValue(contourPoints[i].y, scale)

                minX = Math.min(minX, contourPoints[i].x)
                maxX = Math.max(maxX, contourPoints[i].x)
                minY = Math.min(minY, contourPoints[i].y)
                maxY = Math.max(maxY, contourPoints[i].y)
            }
        })   
        let wantedMidpointX = this.cellWidth / 2
        let currMidpointX = (minX + maxX) / 2
        let signX = (wantedMidpointX > currMidpointX) ? 1 : -1
        let offsetX = Math.abs(wantedMidpointX - currMidpointX) * signX

        let wantedMidpointY = this.cellHeight / 2
        let currMidpointY = (minY + maxY) / 2
        let signY = (wantedMidpointY > currMidpointY) ? 1 : -1
        let offsetY = Math.abs(wantedMidpointY - currMidpointY) * signY

        contoursWithImpliedPoints.forEach(contourPoints => {
            for (let i = 0; i < contourPoints.length; i++) {
                contourPoints[i].x += offsetX
                contourPoints[i].y += offsetY
            }
        })   

        if (moreLengthy) {
            this.cellHeight -= 70;
        }

        let svg = SVG().addTo('#svg-container').size(this.cellWidth, this.cellHeight).css({ padding: '10px' })
        // let colors = ['#f35054', '#517eeb', '#3bf849']
        let colors = ['#f0583c', '#f4d25e', '#ef974a']
        let contourStartIndex = 0
        contoursWithImpliedPoints.forEach(contourPoints => {
            let path = '';
            for (let i = 0; i < contourPoints.length - 2; i += 2) {
                let p0 = contourPoints[i]
                let p1 = contourPoints[i + 1]
                let p2 = contourPoints[i + 2]
                if (i == 0) {
                    path += `M${p0.x} ${p0.y} Q${p1.x} ${p1.y} ${p2.x} ${p2.y} `
                } else {
                    path += `Q${p1.x} ${p1.y} ${p2.x} ${p2.y} `
                }
                // svg.path(`M${p0.x} ${p0.y} Q${p1.x} ${p1.y} ${p2.x} ${p2.y}`).stroke({ color: '#f0583c', width: 7 })
            }
            path += 'Z';
            svg.path(path).stroke({ color: '#f2cc8f', width: 7 })
        })
        // data.endPtsOfContours.forEach(contourEndIndex => {
        //     let numPointsInContour = contourEndIndex - contourStartIndex + 1
        //     let points = data.points.slice(contourStartIndex, contourEndIndex + 1)

        //     for (let i = 0; i < points.length; i += 2) {
        //         let p0 = points[i]
        //         let p1 = points[(i + 1) % points.length]
        //         let p2 = points[(i + 2) % points.length]
        //         svg.path(`M${p0.x} ${p0.y} Q${p1.x} ${p1.y} ${p2.x} ${p2.y}`).stroke({ color: '#f0583c', width: 7 })
        //     }
        // })
        // for (let i = 0; i < data.endPtsOfContours.length; i++) {
        //     let lastPos = [data.points[lastPt + 1].x, data.points[lastPt + 1].y]
        //     for (let pt = lastPt + 2; pt <= data.endPtsOfContours[i]; pt++) {
        //         svg.line(lastPos[0], lastPos[1], data.points[pt].x, data.points[pt].y)
        //            .stroke({ color: colors[i], width: 7 })
        //         lastPos = [data.points[pt].x, data.points[pt].y]
        //     }
        //     svg.line(lastPos[0], lastPos[1], data.points[lastPt + 1].x, data.points[lastPt + 1].y)
        //            .stroke({ color: colors[i], width: 7 })
        //     lastPt = data.endPtsOfContours[i]
        // }
        // contoursWithImpliedPoints.forEach(contourPoints => {
        //     for (let i = 0; i < contourPoints.length; i++) {
        //         svg.circle(13).center(contourPoints[i].x, contourPoints[i].y).fill('#fffdfe')
        //     }
        // })
    }
}