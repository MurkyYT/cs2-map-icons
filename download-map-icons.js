const SteamUser = require('steam-user');
const fs = require('fs');
const vpk = require('./vpk-no-request');
const path = require('path');
const crypto = require('crypto');
const VsvgConverter = require('./vsvg-converter');
const console = require('console');

const appId = 730;
const depotId = 2347770;
const temp = './temp';
const staticDir = './static';
const imagesDir = './images';
const pngDir = imagesDir;
const dataDir = './data';
const manifestFile = path.join(staticDir, 'manifest.txt');
const mapIconRegex = /^panorama\/images\/map_icons\/map_icon_.*\.vsvg_c$/i;
const repo = process.env.GITHUB_REPOSITORY || "MurkyYT/cs2-map-icons";
const defaultBranch = process.env.DEFAULT_BRANCH || "main";

const options = {
    width: 512,
    height: 512,
    backgroundColor: 'transparent'
};

function hashBuffer(buffer) {
    return crypto.createHash('md5').update(buffer).digest('hex').slice(0, 8);
}

function loadExistingData() {
    if (!fs.existsSync(dataDir)) return { count: 0, maps: {} };
    const filePath = path.join(dataDir, 'available.json');
    if (!fs.existsSync(filePath)) return { count: 0, maps: {} };
    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(raw);
    } catch {
        return { count: 0, maps: {} };
    }
}

function writeManifestId(manifestId) {
    fs.writeFileSync(manifestFile, manifestId);
}

function readLastManifestId() {
    if (!fs.existsSync(manifestFile)) return null;
    return fs.readFileSync(manifestFile, 'utf8').trim();
}

async function downloadVPKDir(user, manifest) {
    const dirFile = manifest.manifest.files.find(file =>
        file.filename.endsWith("csgo\\pak01_dir.vpk")
    );
    if (!dirFile) throw new Error("Could not find pak01_dir.vpk in manifest");
    const filePath = path.join(temp, 'pak01_dir.vpk');
    await user.downloadFile(appId, depotId, dirFile, filePath);
    const vpkDir = new vpk(filePath);
    vpkDir.load();
    return vpkDir;
}

function getFiles(vpkDir) {
    return Object.keys(vpkDir.tree).filter(fileName => mapIconRegex.test(fileName));
}

function getRequiredVPKArchives(vpkDir, files) {
    const requiredIndices = new Set();
    for (const fileName of files) {
        const fileInfo = vpkDir.tree[fileName];
        if (fileInfo && fileInfo.archiveIndex !== undefined) requiredIndices.add(fileInfo.archiveIndex);
    }
    return Array.from(requiredIndices).sort((a, b) => a - b);
}

async function downloadVPKArchives(user, manifest, vpkDir, files) {
    const requiredIndices = getRequiredVPKArchives(vpkDir, files);
    for (const archiveIndex of requiredIndices) {
        const paddedIndex = archiveIndex.toString().padStart(3, '0');
        const fileName = `pak01_${paddedIndex}.vpk`;
        const file = manifest.manifest.files.find(f => f.filename.endsWith(fileName));
        if (!file) continue;
        const filePath = path.join(temp, fileName);
        console.log(`Downloading ${fileName}`);
        await user.downloadFile(appId, depotId, file, filePath);
    }
}

async function extractAndConvertMapIcons(vpkDir, files, options = {}) {
    let useSharp = false;
    try { require('sharp'); useSharp = true; } catch { }
    const converter = new VsvgConverter({ useSharp });
    const downloadedData = {};
    const csgoEnglishFile = "resource/csgo_english.txt";
    const fileBuffer = vpkDir.getFile(csgoEnglishFile);
    const fileString = fileBuffer.toString('utf8');
    const regex = /"SFUI_Map_([^"]+)"\s+"([^"]+)"/g;
    const mapNames = {};
    let match;
    while ((match = regex.exec(fileString)) !== null) mapNames[match[1]] = match[2];

    for (const vpkPath of files) {
        const buffer = vpkDir.getFile(vpkPath);
        const fileName = path.basename(vpkPath);
        const m = fileName.match(/map_icon_(.+)\.vsvg_c$/i);
        if (!m) continue;
        const mapName = m[1];
        const mapData = { origin: vpkPath, hash: hashBuffer(buffer) };
        console.log(`Extracted ${mapName}`)
        if (mapNames[mapName]) mapData.display_name = mapNames[mapName];
        try {
            const pngBuffer = await converter.convertToPng(buffer, {
                width: options.width,
                height: options.height,
                backgroundColor: options.backgroundColor
            });
            const pngFileName = `${mapName}.png`;
            fs.writeFileSync(path.join(pngDir, pngFileName), pngBuffer);
            mapData.path = `https://raw.githubusercontent.com/${repo}/${defaultBranch}/images/${pngFileName}`;
        } catch { }
        downloadedData[mapName] = mapData;
    }
    return downloadedData;
}

function generateDataFiles(downloadedData) {
    const existingData = loadExistingData();
    const mergedMaps = { ...existingData.maps };
    for (const mapName in mergedMaps) if (!(mapName in downloadedData)) mergedMaps[mapName].origin = "";
    Object.assign(mergedMaps, downloadedData);
    const availableMaps = { count: Object.keys(mergedMaps).length, maps: mergedMaps };
    fs.writeFileSync(path.join(dataDir, 'available.json'), JSON.stringify(availableMaps, null, 2));
    console.log('Dumped all data to available.json');
    const csvPath = path.join(dataDir, 'available.csv');
    const fieldnames = ['map_name', 'display_name', 'hash', 'origin', 'path'];
    const csvLines = [fieldnames.join(',')];
    for (const mapName of Object.keys(mergedMaps).sort()) {
        const d = mergedMaps[mapName];
        const row = [mapName, d.display_name || '', d.hash || '', d.origin || '', d.path || ''];
        csvLines.push(row.map(s => `"${s}"`).join(','));
    }
    fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf8');
    console.log('Dumped all data to available.csv');
    const mdPath = path.join(dataDir, 'available.md');
    const mdLines = ['| map_name | display_name | hash | origin | path |', '|----------|--------------|------|--------|------|'];
    for (const mapName of Object.keys(mergedMaps).sort()) {
        const d = mergedMaps[mapName];
        const displayName = d.display_name || '-';
        mdLines.push(`| ${mapName} | ${displayName} | ${d.hash || ''} | ${d.origin || ''} | ${d.path || ''} |`);
    }
    fs.writeFileSync(mdPath, mdLines.join('\n'), 'utf8');
    console.log('Dumped all data to available.md');
}

[imagesDir, pngDir, staticDir, dataDir, temp].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const user = new SteamUser();
user.logOn({ anonymous: true });
console.log("Logging in to Steam...");

user.once('loggedOn', async () => {
    try {
        const cs = (await user.getProductInfo([appId], [], true)).apps[appId].appinfo;
        const commonDepot = cs.depots[depotId];
        const latestManifestId = commonDepot.manifests.public.gid;
        console.log("Got manifest id " + latestManifestId);
        const lastManifestId = readLastManifestId();
        if (lastManifestId === latestManifestId) {
            console.log('Manifest unchanged — skipping download');
            process.exit(0);
        }
        const manifest = await user.getManifest(appId, depotId, latestManifestId, 'public');
        const vpkDir = await downloadVPKDir(user, manifest);
        console.log("Downloaded pak01_dir.vpk");
        const files = getFiles(vpkDir);
        await downloadVPKArchives(user, manifest, vpkDir, files);
        const downloadedData = await extractAndConvertMapIcons(vpkDir, files, options);
        generateDataFiles(downloadedData);
        writeManifestId(latestManifestId);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
});

user.on('error', (err) => {
    console.error(err);
    process.exit(1);
});