import { FontParser } from "./loader/fontParser"
import { GlyphRenderer } from "./renderer/glyphRenderer"
import { TextData } from "./renderer/textData"

const fileInput: HTMLInputElement = document.getElementById('file-upload') as HTMLInputElement
const svgContainer: HTMLDivElement = document.getElementById('svg-container') as HTMLDivElement

export const a: number = 5

fileInput.addEventListener('change', () => {
  const file = fileInput.files!![0]

  if (file) {
    const loadAndRender = async (file: File) => {
      let fontData = await FontParser.parseFont(file)
      let glyphRenderer = new GlyphRenderer(fontData)

      // let text = 'abcdefghijklmnopqrstuvwxyz&'
      let text = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ&'
      for (let i = 0; i < text.length; i++) {
        glyphRenderer.drawGlyph(text.charCodeAt(i))
      }

      let textData = new TextData("sigma", fontData)
      console.log(textData.printableChars)
    }

    loadAndRender(file)
  }
})