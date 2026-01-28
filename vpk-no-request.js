"use strict";

const fs = require("fs");
const path = require("path");
const crc = require("crc");

const HEADER_1_LENGTH = 12;
const HEADER_2_LENGTH = 28;

class VPK {
    constructor(directoryPath) {
        this.directoryPath = directoryPath;
        this.tree = {};
        this.header = null;
    }

    isValid() {
        const buffer = Buffer.alloc(HEADER_2_LENGTH);
        const fd = fs.openSync(this.directoryPath, "r");
        fs.readSync(fd, buffer, 0, HEADER_2_LENGTH, 0);
        fs.closeSync(fd);

        return buffer.readUInt32LE(0) === 0x55aa1234 &&
               [1,2].includes(buffer.readUInt32LE(4));
    }

    load() {
        const buffer = fs.readFileSync(this.directoryPath);
        let offset = 0;

        const signature = buffer.readUInt32LE(offset); offset += 4;
        const version = buffer.readUInt32LE(offset); offset += 4;
        const treeLength = buffer.readUInt32LE(offset); offset += 4;

        let unknown1, footerLength, unknown3, unknown4;
        if (version === 2) {
            unknown1 = buffer.readUInt32LE(offset); offset += 4;
            footerLength = buffer.readUInt32LE(offset); offset += 4;
            unknown3 = buffer.readUInt32LE(offset); offset += 4;
            unknown4 = buffer.readUInt32LE(offset); offset += 4;
        }

        this.header = { signature, version, treeLength, unknown1, footerLength, unknown3, unknown4 };

        offset = version === 2 ? HEADER_2_LENGTH : HEADER_1_LENGTH;
        const treeEnd = offset + treeLength;
        this.tree = {};

        function readString() {
            const end = buffer.indexOf(0x00, offset);
            if (end === -1) throw new Error("Unexpected end of buffer while reading string");
            const str = buffer.toString("utf8", offset, end);
            offset = end + 1;
            return str;
        }

        while (true) {
            const extension = readString();
            if (!extension) break;

            while (true) {
                const directory = readString();
                if (!directory) break;

                while (true) {
                    const filename = readString();
                    if (!filename) break;

                    const entry = {
                        crc: buffer.readUInt32LE(offset), offset: 0,
                        preloadBytes: buffer.readUInt16LE(offset + 4),
                        archiveIndex: buffer.readUInt16LE(offset + 6),
                        entryOffset: buffer.readUInt32LE(offset + 8),
                        entryLength: buffer.readUInt32LE(offset + 12)
                    };

                    offset += 16;

                    const terminator = buffer.readUInt16LE(offset);
                    offset += 2;
                    if (terminator !== 0xffff) throw new Error("Invalid directory terminator");

                    entry.preloadOffset = offset;
                    offset += entry.preloadBytes;

                    const fullPath = path.posix.join(directory, filename + (extension ? "." + extension : ""));
                    this.tree[fullPath] = entry;
                }
            }
        }
    }

    get files() {
        return Object.keys(this.tree);
    }

    getFile(filePath) {
        const entry = this.tree[filePath];
        if (!entry) return null;

        const buf = Buffer.alloc(entry.preloadBytes + entry.entryLength);

        if (entry.preloadBytes > 0) {
            const fd = fs.openSync(this.directoryPath, "r");
            fs.readSync(fd, buf, 0, entry.preloadBytes, entry.preloadOffset);
            fs.closeSync(fd);
        }

        if (entry.entryLength > 0) {
            if (entry.archiveIndex === 0x7fff) {
                const offset = (this.header.version === 2 ? HEADER_2_LENGTH : HEADER_1_LENGTH) + entry.entryOffset;
                const fd = fs.openSync(this.directoryPath, "r");
                fs.readSync(fd, buf, entry.preloadBytes, entry.entryLength, offset);
                fs.closeSync(fd);
            } else {
                const fileIndex = ("000" + entry.archiveIndex).slice(-3);
                const archivePath = this.directoryPath.replace(/_dir\.vpk$/, `_${fileIndex}.vpk`);
                const fd = fs.openSync(archivePath, "r");
                fs.readSync(fd, buf, entry.preloadBytes, entry.entryLength, entry.entryOffset);
                fs.closeSync(fd);
            }
        }

        if (crc.crc32(buf) !== entry.crc) throw new Error("CRC does not match");

        return buf;
    }
}

module.exports = VPK;