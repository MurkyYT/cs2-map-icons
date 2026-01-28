/**
 * VSVG to PNG Converter
 * 
 * Converts Valve's vsvg_c (compiled vector graphics) files to PNG format.
 * Based on reverse-engineering from ValveResourceFormat repository.
 */

const fs = require('fs').promises;
const { createCanvas, Image } = require('canvas');

let sharp;
try {
    sharp = require('sharp');
} catch {}

class VsvgConverter {
    constructor(options = {}) {
        this.debug = options.debug || false;
        this.useSharp = options.useSharp && sharp;
        if (options.useSharp && !sharp) {
            console.warn('[VSVG] Sharp not available, falling back to canvas rendering');
        }
    }

    log(message, data) {
        if (this.debug) {
            console.log(`[VSVG Debug] ${message}`, data || '');
        }
    }

    async convertToPng(buffer, options = {}) {
        const svgData = this.parseVsvgFile(buffer);
        const pngBuffer = await this.renderSvgToPng(svgData, options);
        return pngBuffer;
    }

    parseVsvgFile(buffer) {
        this.log('Parsing vsvg_c file', `Size: ${buffer.length} bytes`);
        let svgData = null;
        try { svgData = this.parseAsResource(buffer); if (svgData) return svgData; } catch {}
        try { svgData = this.findSvgInBuffer(buffer); if (svgData) return svgData; } catch {}
        throw new Error('Could not extract SVG data from vsvg_c file');
    }

    parseAsResource(buffer) {
        if (buffer.length < 16) return null;
        let offset = 0;
        const fileSize = buffer.readUInt32LE(offset); offset += 4;
        const headerVersion = buffer.readUInt16LE(offset); offset += 2;
        const version = buffer.readUInt16LE(offset); offset += 2;
        const blockOffset = buffer.readUInt32LE(offset); offset += 4;
        const blockCount = buffer.readUInt32LE(offset); offset += 4;
        if (blockOffset > buffer.length || blockCount > 100 || blockCount < 1) return null;
        offset = blockOffset;
        for (let i = 0; i < blockCount; i++) {
            if (offset + 12 > buffer.length) break;
            const blockType = buffer.toString('utf8', offset, offset + 4).replace(/\0/g, ''); offset += 4;
            const dataOffset = buffer.readUInt32LE(offset); offset += 4;
            const dataSize = buffer.readUInt32LE(offset); offset += 4;
            if (blockType === 'DATA' && dataOffset < buffer.length && dataSize > 0) {
                const dataBuffer = buffer.slice(dataOffset, Math.min(dataOffset + dataSize, buffer.length));
                const svgData = this.extractSvgFromData(dataBuffer);
                if (svgData) return svgData;
            }
        }
        return null;
    }

    extractSvgFromData(dataBuffer) {
        const text = dataBuffer.toString('utf8');
        if (text.includes('<svg') && text.includes('</svg>')) {
            const svgMatch = text.match(/<svg[\s\S]*?<\/svg>/i);
            if (svgMatch) return svgMatch[0];
        }
        return null;
    }

    findSvgInBuffer(buffer) {
        const text = buffer.toString('utf8');
        const svgStart = text.indexOf('<svg');
        if (svgStart !== -1) {
            const svgEnd = text.indexOf('</svg>', svgStart);
            if (svgEnd !== -1) return text.substring(svgStart, svgEnd + 6);
        }
        return null;
    }

    async renderSvgToPng(svgData, options = {}) {
        if (this.useSharp) return this.renderSvgWithSharp(svgData, options);
        return this.renderSvgWithCanvas(svgData, options);
    }

    async renderSvgWithSharp(svgData, options = {}) {
        const dimensions = this.parseSvgDimensions(svgData);
        const targetWidth = options.width || dimensions.width || 256;
        const targetHeight = options.height || dimensions.height || 256;
        const backgroundColor = options.backgroundColor || 'transparent';
        try {
            let sharpInstance = sharp(Buffer.from(svgData), { density: 300 });
            sharpInstance = sharpInstance.resize(targetWidth, targetHeight, {
                fit: 'contain',
                background: backgroundColor === 'transparent' ? { r: 0, g: 0, b: 0, alpha: 0 } : backgroundColor
            });
            return await sharpInstance.png().toBuffer();
        } catch {
            return this.renderSvgWithCanvas(svgData, options);
        }
    }

    async renderSvgWithCanvas(svgData, options = {}) {
        const dimensions = this.parseSvgDimensions(svgData);
        const nativeWidth = dimensions.width || 256;
        const nativeHeight = dimensions.height || 256;
        const targetWidth = options.width || nativeWidth;
        const targetHeight = options.height || nativeHeight;
        const scale = options.scale || 1;
        const backgroundColor = options.backgroundColor || 'transparent';
        const finalWidth = targetWidth * scale;
        const finalHeight = targetHeight * scale;
        const renderScale = Math.max(finalWidth / nativeWidth, finalHeight / nativeHeight, 1);
        const renderWidth = Math.ceil(nativeWidth * renderScale);
        const renderHeight = Math.ceil(nativeHeight * renderScale);
        let modifiedSvg = svgData;
        if (!modifiedSvg.includes('width=') || !modifiedSvg.includes('height=')) {
            modifiedSvg = modifiedSvg.replace(/<svg/, `<svg width="${renderWidth}" height="${renderHeight}"`);
        } else {
            modifiedSvg = modifiedSvg.replace(/width=["']?\d+(?:\.\d+)?[^"'\s>]*/i, `width="${renderWidth}"`)
                .replace(/height=["']?\d+(?:\.\d+)?[^"'\s>]*/i, `height="${renderHeight}"`);
        }
        const canvas = createCanvas(renderWidth, renderHeight);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        if (backgroundColor !== 'transparent') {
            ctx.fillStyle = backgroundColor;
            ctx.fillRect(0, 0, renderWidth, renderHeight);
        }
        const svgDataUrl = `data:image/svg+xml;base64,${Buffer.from(modifiedSvg).toString('base64')}`;
        const img = new Image();
        return new Promise((resolve, reject) => {
            img.onload = () => {
                ctx.drawImage(img, 0, 0, renderWidth, renderHeight);
                if (renderWidth !== finalWidth || renderHeight !== finalHeight) {
                    const finalCanvas = createCanvas(finalWidth, finalHeight);
                    const finalCtx = finalCanvas.getContext('2d');
                    finalCtx.imageSmoothingEnabled = true;
                    finalCtx.imageSmoothingQuality = 'high';
                    if (backgroundColor !== 'transparent') {
                        finalCtx.fillStyle = backgroundColor;
                        finalCtx.fillRect(0, 0, finalWidth, finalHeight);
                    }
                    finalCtx.drawImage(canvas, 0, 0, finalWidth, finalHeight);
                    resolve(finalCanvas.toBuffer('image/png'));
                } else {
                    resolve(canvas.toBuffer('image/png'));
                }
            };
            img.onerror = (err) => reject(new Error(`Failed to load SVG: ${err}`));
            img.src = svgDataUrl;
        });
    }

    parseSvgDimensions(svgData) {
        const widthMatch = svgData.match(/width=["']?(\d+(?:\.\d+)?)/);
        const heightMatch = svgData.match(/height=["']?(\d+(?:\.\d+)?)/);
        const viewBoxMatch = svgData.match(/viewBox=["']?[\d.]+\s+[\d.]+\s+([\d.]+)\s+([\d.]+)/);
        let width, height;
        if (widthMatch && heightMatch) {
            width = parseFloat(widthMatch[1]);
            height = parseFloat(heightMatch[1]);
        } else if (viewBoxMatch) {
            width = parseFloat(viewBoxMatch[1]);
            height = parseFloat(viewBoxMatch[2]);
        }
        return { width, height };
    }

    async extractSvg(buffer) {
        return this.parseVsvgFile(buffer);
    }
}

module.exports = VsvgConverter;