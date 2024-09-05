import { PrintableCharacter, FontData } from "../loader/fontData"

export class TextData {
    spaceSizeEM: number = 0.333
    lineHeightEM: number = 1.3

    readonly printableChars: PrintableCharacter[]

    constructor (text: string, fontData: FontData) {
        let scale = 1 / fontData.unitsPerEm

        let charPos = 0
        let wordPos = 0
        let line = 0
        let printableChars: PrintableCharacter[] = []
        for (let i = 0; i < text.length; i++) {
            if (text[i] == ' ') {
                wordPos += this.spaceSizeEM
            } else if (text[i] == '\t') {
                wordPos += this.spaceSizeEM * 4
            } else if (text[i] == '\n') {
                line += this.lineHeightEM
                wordPos = charPos = 0
            } else {
                let glyph = fontData.getGlyph(text.charCodeAt(i))

                let glyphWidth = glyph.maxX - glyph.minX
                let offsetX = (glyph.minX + glyphWidth / 2) * scale

                let glyphHeight = glyph.maxY - glyph.minY
                let offsetY = (glyph.minY + glyphHeight / 2) * scale

                let printableChar = new PrintableCharacter(glyph.glyphIndex, charPos, wordPos, line, offsetX, offsetY)
                printableChars.push(printableChar)
                charPos += glyph.advanceWidth * scale
            }
        }

        this.printableChars = printableChars
    }
}