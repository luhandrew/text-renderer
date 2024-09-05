export class FontReader {
    fileReader: FileReader
    bytes!: Uint8Array
    reader!: DataView
    byteOffset: number = 0;

    constructor (file: File) {
        this.fileReader = new FileReader()
        this.fileReader.onloadend = (e) => {
            this.bytes = new Uint8Array(e.target?.result as ArrayBuffer)
            this.reader = new DataView(this.bytes.buffer)
        }
        this.fileReader.readAsArrayBuffer(file)
    }   

    getPos (): number {
        return this.byteOffset
    }

    goTo (bytesOffset: number) {
        this.byteOffset = bytesOffset
    }

    skipBytes (numBytes: number) {
        this.byteOffset += numBytes;
    }

    readFWord (): number {
        return this.readInt16()
    }
    readTag (): string {
        return this.readString(4);
    }

    readFixedPoint2Dot14 (): number {
        return this.UInt16ToFixedPoint2Dot14(this.readUInt16())
    }

    UInt16ToFixedPoint2Dot14 (raw: number): number {
        return raw / (1 << 14)
    }

    readString (numBytes: number): string {
        const val = new TextDecoder('ascii')
            .decode(this.bytes.subarray(this.byteOffset, this.byteOffset + numBytes));
        this.byteOffset += numBytes;
        return val;
    }

    readSByte (): number {
        const val = this.reader.getInt8(this.byteOffset)
        this.byteOffset += 1;
        return val;
    }

    readByte (): number {
        const val = this.reader.getUint8(this.byteOffset);
        this.byteOffset += 1; /* skip only 1 byte */
        return val;
    }

    readUInt16 (): number {
        const val = this.reader.getUint16(this.byteOffset)
        this.byteOffset += 2; /* skip 2 bytes, since 16 / 8 = 2 */
        return val;
    }

    readInt16 (): number {
        const val = this.reader.getInt16(this.byteOffset)
        this.byteOffset += 2;
        return val
    }

    readUInt32 (): number {
        const val = this.reader.getUint32(this.byteOffset)
        this.byteOffset += 4; /* skip 4 bytes, since 32 / 8 = 4 */
        return val;
    }

    readInt32 (): number {
        const val = this.reader.getInt32(this.byteOffset)
        this.byteOffset += 4;
        return val;
    }
}