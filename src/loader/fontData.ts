import type { Vector2 } from "../models/Vector2"
import type { Point } from "../models/Point"

export class FontData {
    glyphs: GlyphData[]
    missingGlyph?: GlyphData
    unitsPerEm: number

    glyphMap: Record<number, GlyphData>

    constructor (glyphs: GlyphData[], unitsPerEm: number) {
        this.glyphs = glyphs
        this.unitsPerEm = unitsPerEm

        this.glyphMap = {}
        this.glyphs.forEach(glyph => {
            this.glyphMap[glyph.unicodeValue] = glyph
            if (glyph.glyphIndex == 0) {
                this.missingGlyph = glyph
            }
        })

        if (this.missingGlyph == undefined) {
            throw new Error(`No missing character glyph was found!`)
        }
    }

    getGlyph (unicode: number) {
        /* TODO: Handle when we don't find this unicode */
        console.log(`Unicode: ${unicode} Glyph Data: ${this.glyphMap[unicode].glyphIndex}`)
        return this.glyphMap[unicode]
    }
}

export class GlyphData {
    unicodeValue!: number
    glyphIndex!: number
    points!: Array<Point>
    endPtsOfContours!: Array<number>
    advanceWidth!: number
    leftSideBearing!: number

    minX!: number
    maxX!: number
    minY!: number
    maxY!: number
}

export class GlyphMapping {
    readonly glyphIndex: number
    readonly unicodeValue: number

    constructor (glyphIndex: number, unicodeValue: number) {
        this.glyphIndex = glyphIndex
        this.unicodeValue = unicodeValue
    }
}

export class PrintableCharacter {
    readonly glyphIndex: number
    readonly charPos: number
    readonly wordPos: number
    readonly line: number
    readonly offsetX: number
    readonly offsetY: number

    constructor (glyphIndex: number, charPos: number, wordPos: number, line: number, offsetX: number, offsetY: number) {
        this.glyphIndex = glyphIndex
        this.charPos = charPos
        this.wordPos = wordPos
        this.line = line
        this.offsetX = offsetX
        this.offsetY = offsetY
    }
}