import { FontReader } from "./fontReader";
import { FontData, GlyphData, GlyphMapping } from "./fontData"
import { isBitSet } from "../utils/byteUtils"
import { GlyphRenderer } from "../renderer/glyphRenderer";
import { Point } from "../models/Point";
import { Vector2 } from "../models/Vector2";
import { createContoursWithImpliedPoints } from "../utils/glyphUtils";

export abstract class FontParser {
    static reader: FontReader

    static parseFont (font: File): Promise<FontData> {
        return new Promise((resolve, reject) => {
            this.reader = new FontReader(font)
            /* -- Waiting for the font reader to finish loading the file -- */
            this.reader.fileReader.addEventListener("loadend", e => {
                if (this.reader.fileReader.result != null) {
                    console.log(`Finished loading font!`)
                    resolve(this.startParsing())
                } else {
                    reject(new Error(`Failed to load font!`))
                }
            })
        })
    }

    static startParsing (): FontData {
        /* -- Get table locations -- */
        let tableLocations = this.readTableLocations()
        
        /* -- Read head table -- */
        this.reader.goTo(tableLocations["head"])
        this.reader.skipBytes(18)
        let unitsPerEm = this.reader.readUInt16()
        this.reader.skipBytes(30)
        let numBytesPerLocation = (this.reader.readInt16() == 0 ? 2 : 4)

        /* -- Read maxp table -- */
        this.reader.goTo(tableLocations["maxp"])
        this.reader.skipBytes(4)
        let numGlyphs = this.reader.readUInt16()
        let glyphLocations = this.getAllGlyphLocations(numGlyphs, numBytesPerLocation, tableLocations["loca"], tableLocations["glyf"])

        let glyphMappings = this.getUnicodeToGlyphMappings(tableLocations["cmap"])
        let glyphs = this.readAllGlyphs(glyphLocations, glyphMappings)

        /* -- Read hhea table -- */
        this.reader.goTo(tableLocations["hhea"])

        this.reader.skipBytes(8) // unused: version, ascent, descent
        let lineGap = this.reader.readInt16()
        let advanceWidthMax = this.reader.readInt16()
        this.reader.skipBytes(22) // unused: minLeftSideBearing, minRightSideBearing, xMaxExtent, caretSlope, reserved, metricDataFormat
        let numAdvanceWidthMetrics = this.reader.readInt16()

        /* -- Read hmtx table -- */
        this.reader.goTo(tableLocations["hmtx"])

        let layoutData: {advanceWidth: number, leftSideBearing: number}[] = []
        let lastAdvanceWidth: number = -1
        for (let i = 0; i < numAdvanceWidthMetrics; i++) {
            let advanceWidth = this.reader.readUInt16()
            let leftSideBearing = this.reader.readInt16()
            lastAdvanceWidth = advanceWidth

            layoutData.push({advanceWidth: advanceWidth, leftSideBearing: leftSideBearing})
        }

        let numRemaining = numGlyphs - numAdvanceWidthMetrics
        for (let i = 0; i < numRemaining; i++) {
            let leftSideBearing = this.reader.readInt16()

            layoutData.push({advanceWidth: lastAdvanceWidth, leftSideBearing: leftSideBearing})
        }

        glyphs.forEach(glyph => {
            glyph.advanceWidth = layoutData[glyph.glyphIndex].advanceWidth
            glyph.leftSideBearing = layoutData[glyph.glyphIndex].leftSideBearing
        })

        let fontData = new FontData(glyphs, unitsPerEm)
        return fontData
    } 

    static readTableLocations (): Record<string, number> {
        let tableLocations: Record<string, number> = {}

        /* -- Offset Subtable -- */
        this.reader.skipBytes(4) // unused: scalerType
        let numTables = this.reader.readUInt16()
        this.reader.skipBytes(6) // unused: searchRange, entrySelector, rangeShift

        /* -- Table Directory -- */
        for (var i = 0; i < numTables; i++) {
            const tag = this.reader.readTag()
            const checkSum = this.reader.readUInt32()
            const offset = this.reader.readUInt32()
            const length = this.reader.readUInt32()

            tableLocations[tag] = offset
        }

        return tableLocations
    }

    static readAllGlyphs (glyphLocations: number[], glyphMappings: GlyphMapping[]) {
        let glyphs = []

        for (let i = 0; i < glyphMappings.length; i++) {
            let glyphMapping = glyphMappings[i]
            let glyphData = this.readGlyph(glyphLocations, glyphMapping.glyphIndex)
            glyphData.unicodeValue = glyphMapping.unicodeValue
            glyphs.push(glyphData)
        }

        return glyphs
    }

    static readGlyph (glyphLocations: number[], glyphIndex: number) {
        let glyphLocation = glyphLocations[glyphIndex]

        this.reader.goTo(glyphLocation)
        let numContours = this.reader.readInt16()

        let isSimpleGlyph = numContours >= 0
        if (isSimpleGlyph) {
            return this.readSimpleGlyph(glyphLocations, glyphIndex)
        } else {
            return this.readCompoundGlyph(glyphLocations, glyphIndex)
        }
    }

    static readSimpleGlyph (glyphLocations: number[], glyphIndex: number) {
        this.reader.goTo(glyphLocations[glyphIndex])

        let glyphData = new GlyphData()
        glyphData.glyphIndex = glyphIndex

        let numContours = this.reader.readInt16()
        if (numContours < 0) {
            throw new Error(`Expected simple glyph, but found a compound one!`)
        }

        /* -- read bounds -- */
        glyphData.minX = this.reader.readFWord()
        glyphData.minY = this.reader.readFWord()
        glyphData.maxX = this.reader.readFWord()
        glyphData.maxY = this.reader.readFWord()

        /* -- read contour ends -- */
        let numPoints = 0
        let contourEndPoints = []
        for (let i = 0; i < numContours; i++) {
            let contourEndPoint = this.reader.readUInt16()
            numPoints = Math.max(numPoints, contourEndPoint + 1)

            contourEndPoints.push(contourEndPoint)
        }

        /* -- skip instructions -- */
        let numInstructions = this.reader.readInt16()
        this.reader.skipBytes(numInstructions)

        /* -- read flags -- */
        let flags = []
        let points: Point[] = []

        const ON_CURVE_BIT = 0
        const SINGLE_BYTE_X_BIT = 1
        const SINGLE_BYTE_Y_BIT = 2
        const REPEAT_BIT = 3
        const MODIFY_X_BIT = 4
        const MODIFY_Y_BIT = 5

        for (let i = 0; i < numPoints; i++) {
            let flag = this.reader.readByte()
            flags.push(flag)

            if (isBitSet(flag, REPEAT_BIT)) {
                let numRepeat = this.reader.readByte()
                for (let j = 0; j < numRepeat; j++) {
                    i++
                    flags.push(flag)
                }
            }
        }

        const readCoords = (readingXAxis: boolean) => {
            let coordByteBit = readingXAxis ? SINGLE_BYTE_X_BIT : SINGLE_BYTE_Y_BIT
            let coordModifyBit = readingXAxis ? MODIFY_X_BIT : MODIFY_Y_BIT

            let coord = 0
            for (let i = 0; i < numPoints; i++) {
                let flag = flags[i]
                
                /* -- it's gonna be a single byte coord -- */
                if (isBitSet(flag, coordByteBit)) {
                    let offset = this.reader.readByte()
                    let positiveOffset = isBitSet(flag, coordModifyBit)
                    let sign = positiveOffset ? 1 : -1
                    coord += offset * sign
                } else if (!isBitSet(flag, coordModifyBit)) { /* -- update with a positive offset -- */
                    coord += this.reader.readInt16()
                }

                if (readingXAxis) {
                    points.push(new Point(coord, -1))
                } else {
                    points[i].y = coord
                }
                points[i].onCurve = isBitSet(flag, ON_CURVE_BIT)
            }
        }

        readCoords(true)
        readCoords(false)

        glyphData.points = points
        glyphData.endPtsOfContours = contourEndPoints

        if (glyphIndex == 45) {
            console.log(glyphData)
        }
        return glyphData
    }

    static readCompoundGlyph (glyphLocations: number[], glyphIndex: number) {
        let compoundGlyph = new GlyphData()
        compoundGlyph.glyphIndex = glyphIndex

        let glyphlocation = glyphLocations[glyphIndex]
        this.reader.goTo(glyphlocation)
        this.reader.skipBytes(2) // unused: number of contours

        compoundGlyph.minX = this.reader.readFWord()
        compoundGlyph.minY = this.reader.readFWord()
        compoundGlyph.maxX = this.reader.readFWord()
        compoundGlyph.maxY = this.reader.readFWord()

        let allPoints: Point[] = []
        let allContourEndPts: number[] = []

        while (true) {
            let data = this.readComponentGlyph(glyphLocations, glyphlocation)
            let componentGlyph = data.glyph

            /* -- add all points and contour ends (make sure to offset them to account for previous components) -- */
            componentGlyph.endPtsOfContours.forEach(point => {
                allContourEndPts.push(point + allPoints.length)
            })
            componentGlyph.points.forEach(point => {
                allPoints.push(point)
            })  

            if (!data.areMore) {
                break
            }
        }

        compoundGlyph.points = allPoints
        compoundGlyph.endPtsOfContours = allContourEndPts
        return compoundGlyph
    }

    /* -- reads part of the compound glyph -- */
    static readComponentGlyph (glyphLocations: number[], glyphLocation: number) {
        let flag = this.reader.readUInt16()
        let glyphIndex = this.reader.readUInt16()

        let componentGlyphLocation = glyphLocations[glyphIndex]

        let argsAreWords = isBitSet(flag, 0)
        let argsAreXYValues = isBitSet(flag, 1)
        let roundXYToGrid = isBitSet(flag, 2)
        let isSimpleScale = isBitSet(flag, 3)
        let moreComponents = isBitSet(flag, 5)
        let isXYScale = isBitSet(flag, 6)
        let is2x2Matrix = isBitSet(flag, 7)
        let hasInstructions = isBitSet(flag, 8)
        let useThisMetrics = isBitSet(flag, 9)
        let componentsOverlap = isBitSet(flag, 10)

        let arg1 = argsAreWords ? this.reader.readInt16() : this.reader.readSByte()
        let arg2 = argsAreWords ? this.reader.readInt16() : this.reader.readSByte()

        if (!argsAreXYValues) {
            throw new Error(`We don't yet support args that are not xy values`)
        }

        let offsetX = arg1
        let offsetY = arg2

        let iHat_x = 1
        let iHat_y = 0
        let jHat_x = 0
        let jHat_y = 1

        if (isSimpleScale) {
            iHat_x = this.reader.readFixedPoint2Dot14()
            jHat_y = iHat_x
        } else if (isXYScale) {
            iHat_x = this.reader.readFixedPoint2Dot14()
            jHat_y = this.reader.readFixedPoint2Dot14()
        } else if (is2x2Matrix) {
            iHat_x = this.reader.readFixedPoint2Dot14()
            iHat_y = this.reader.readFixedPoint2Dot14()
            jHat_x = this.reader.readFixedPoint2Dot14()
            jHat_y = this.reader.readFixedPoint2Dot14()
        }

        let readerLoc = this.reader.getPos()
        let simpleGlyph = this.readGlyph(glyphLocations, glyphIndex)
        this.reader.goTo(readerLoc)
        
        const transformPoint = (x: number, y: number) => {
            let xPrime = iHat_x * x + jHat_x * y + offsetX
            let yPrime = iHat_y * x + jHat_y * y + offsetY
            return {x: xPrime, y: yPrime}
        }   

        for (let i = 0; i < simpleGlyph.points.length; i++) {
            let coords = transformPoint(simpleGlyph.points[i].x, simpleGlyph.points[i].y)
            simpleGlyph.points[i].x = coords.x
            simpleGlyph.points[i].y = coords.y
        }

        return {glyph: simpleGlyph, areMore: moreComponents}
    }

    static getAllGlyphLocations (numGlyphs: number, bytesPerLocation: number, locaTableLocation: number, glyphTableLocation: number) {
        /* -- Get the glyph locations from the 'loca' table -- */
        let allGlyphLocations = []
        let isTwoByteEntry = bytesPerLocation == 2
        for (let glyphIndex = 0; glyphIndex < numGlyphs; glyphIndex++) {
            this.reader.goTo(locaTableLocation + glyphIndex * bytesPerLocation)

            /* -- If a 2-byte format is used, then the stored location is half of the actual location -- */
            let glyphDataOffset = isTwoByteEntry ? this.reader.readUInt16() * 2 : this.reader.readUInt32()
            allGlyphLocations[glyphIndex] = glyphTableLocation + glyphDataOffset
        }
        return allGlyphLocations
    }

    static getUnicodeToGlyphMappings (cmapTableLocation: number) {
        let glyphMappings = []
        this.reader.goTo(cmapTableLocation)

        let version = this.reader.readUInt16()
        /* -- fonts have different encodings based on the platform -- */
        let numSubtables = this.reader.readUInt16()

        /* -- read through each subtable to find the one we need -- */
        let subtableOffset = 0
        let setlectedUnicodePlatformSpecificID = -1
        for (let i = 0; i < numSubtables; i++) {
            let platformID = this.reader.readUInt16()
            let paltformSpecificID = this.reader.readUInt16()
            let offset = this.reader.readUInt32()
            
            /* -- unicode encoding -- */
            if (platformID == 0) {
                if ((paltformSpecificID == 0 || paltformSpecificID == 1 || paltformSpecificID == 3 || paltformSpecificID == 4) 
                    && paltformSpecificID > setlectedUnicodePlatformSpecificID) {
                        subtableOffset = offset
                        setlectedUnicodePlatformSpecificID = paltformSpecificID
                }
            } else if (platformID == 3 && setlectedUnicodePlatformSpecificID == -1) { /* -- microsoft encoding -- */
                subtableOffset = offset
            }
        }

        if (subtableOffset == 0) {
            throw new Error(`We currently don't support any of the font's character map types`)
        }

        /* -- read through the character map -- */
        this.reader.goTo(cmapTableLocation + subtableOffset)
        let format = this.reader.readUInt16()
        let hasEncounteredMissingCharGlyph = false

        if (format != 4 && format != 12) {
            throw new Error(`We currently don't support this character map format!`)
        }

        console.log(`Subtable offset: ${subtableOffset}`)
        console.log(`Selected unicode platform specific id: ${setlectedUnicodePlatformSpecificID}`)
        console.log(`The table has format: ${format}`)
        /* -- handle format 4 -- */
        if (format == 4) {
            let length = this.reader.readUInt16()
            let languageCode = this.reader.readUInt16()
            let segCountX2 = this.reader.readUInt16()
            let segCount = segCountX2 / 2
            this.reader.skipBytes(6) // unused: searchRange, entrySelector, rangeShift

            /* -- ending character codes for each segment -- */
            let endCodes = []
            for (let i = 0; i < segCount; i++) {
                endCodes[i] = this.reader.readUInt16()
            }

            this.reader.skipBytes(2) // skip: reservedPad

            /* -- starting character codes for each segment -- */
            let startCodes = []
            for (let i = 0; i < segCount; i++) {
                startCodes[i] = this.reader.readUInt16()
            }

            /* -- deltas for all character codes in segment -- */
            let idDeltas = []
            for (let i = 0; i < segCount; i++) {
                idDeltas[i] = this.reader.readUInt16()
            }
            
            /* -- offset in bytes for the glyph index array -- */
            let idRangeOffsets: {offset: number, locAtRead: number}[] = []
            for (let i = 0; i < segCount; i++) {
                let locAtRead = this.reader.getPos()
                let offset = this.reader.readUInt16()
                idRangeOffsets[i] = {offset: offset, locAtRead: locAtRead}
            }

            /* -- the glyph index array -- */
            for (let i = 0; i < segCount; i++) {
                let code = startCodes[i]
                let startCode = startCodes[i]
                let endCode = endCodes[i]
                
                /* -- to avoid out of bounds -- */
                if (code == 65535) {
                    break;
                }

                while (code <= endCode) {
                    let glyphIndex

                    /* -- if the offset is 0, then the index can be calculted just by using the delta -- */
                    if (idRangeOffsets[i].offset == 0) {
                        glyphIndex = (code + idDeltas[i]) % 65536
                    } else {
                        /* -- otherwise, we need to look it up from an array -- */
                        let readerLoc = this.reader.getPos()
                        let rangeOffsetLoc = idRangeOffsets[i].locAtRead + idRangeOffsets[i].offset
                        let glyphIndexArrayLoc = rangeOffsetLoc + 2 * (code - startCode)

                        this.reader.goTo(glyphIndexArrayLoc)
                        glyphIndex = this.reader.readUInt16()

                        if (glyphIndex != 0) {
                            glyphIndex = (glyphIndex + idDeltas[i]) % 65536
                        }

                        /* -- go back to the original location -- */
                        this.reader.goTo(readerLoc)
                    }
                    glyphMappings.push(new GlyphMapping(glyphIndex, code))
                    if (glyphIndex == 0) {
                        hasEncounteredMissingCharGlyph = true
                    }
                    code++
                }
            }
        } else if (format == 12) { /* -- handle format 12 -- */
            this.reader.skipBytes(10) // unused: reserved, length, language
            let numGroups = this.reader.readUInt32()

            for (let i = 0; i < numGroups; i++) {
                let startCharCode = this.reader.readUInt32()
                let endCharCode = this.reader.readUInt32()
                let startGlyphCode = this.reader.readUInt32()

                let numChars = endCharCode - startCharCode + 1
                for (let codeOffset = 0; codeOffset < numChars; codeOffset++) {
                    let charCode = startCharCode + codeOffset
                    let glyphCode = startGlyphCode + codeOffset

                    glyphMappings.push(new GlyphMapping(glyphCode, charCode))
                    if (glyphCode == 0) {
                        hasEncounteredMissingCharGlyph = true
                    }
                }
            }
        }

        if (!hasEncounteredMissingCharGlyph) {
            glyphMappings.push(new GlyphMapping(0, 65535))
        }

        return glyphMappings
    }   
}