const SteamUser = require('steam-user');
const fs = require('fs');
const vpk = require('./vpk-no-request');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const { execFile } = require('child_process');
const AdmZip = require('adm-zip');
const VsvgConverter = require('./vsvg-converter');
const console = require('console');

const appId = 730;
const depotId = 2347770;
const temp = './temp';
const staticDir = './static';
const imagesDir = './images';
const pngDir = imagesDir;
const dataDir = './data';
const radarDir = path.join(imagesDir, 'radars');
const thumbDir = path.join(imagesDir, 'thumbs');
const s2vDir = './s2v';
const s2vVersionFile = path.join(s2vDir, 'version.txt');
const manifestFile = path.join(staticDir, 'manifest.txt');
const mapIconRegex = /^panorama\/images\/map_icons\/map_icon_.*\.vsvg_c$/i;
const radarRegex = /^panorama\/images\/overheadmaps\/.*\.vtex_c$/i;
const thumbRegex = /^panorama\/images\/map_icons\/screenshots\/1080p\/.*\.vtex_c$/i;
const repo = process.env.GITHUB_REPOSITORY || "MurkyYT/cs2-map-icons";
const defaultBranch = process.env.DEFAULT_BRANCH || "main";
const S2V_REPO = 'ValveResourceFormat/ValveResourceFormat';

const options = {
    width: 512,
    height: 512,
    backgroundColor: 'transparent'
};

function getS2vAssetName() {
    switch (process.platform) {
        case 'win32':  return 'cli-windows-x64.zip';
        case 'darwin': return 'cli-osx-x64.zip';
        default:       return 'cli-linux-x64.zip';
    }
}

function getS2vExePath() {
    const exe = process.platform === 'win32' ? 'Source2Viewer-CLI.exe' : 'Source2Viewer-CLI';
    return path.join(s2vDir, exe);
}

function hashBuffer(buffer) {
    return crypto.createHash('md5').update(buffer).digest('hex').slice(0, 8);
}

function loadExistingData() {
    if (!fs.existsSync(dataDir)) return { count: 0, maps: {} };
    const filePath = path.join(dataDir, 'available.json');
    if (!fs.existsSync(filePath)) return { count: 0, maps: {} };
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
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

async function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'cs2-map-icons' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
            res.on('error', reject);
        }).on('error', reject);
    });
}

async function downloadFileHTTPS(url, destPath) {
    return new Promise((resolve, reject) => {
        const follow = (u) => {
            https.get(u, { headers: { 'User-Agent': 'cs2-map-icons' } }, (res) => {
                if (res.statusCode === 301 || res.statusCode === 302) return follow(res.headers.location);
                const chunks = [];
                res.on('data', chunk => chunks.push(chunk));
                res.on('end', () => { fs.writeFileSync(destPath, Buffer.concat(chunks)); resolve(); });
                res.on('error', reject);
            }).on('error', reject);
        };
        follow(url);
    });
}

async function ensureSource2ViewerCLI() {
    if (!fs.existsSync(s2vDir)) fs.mkdirSync(s2vDir, { recursive: true });

    const release = await fetchJson(`https://api.github.com/repos/${S2V_REPO}/releases/latest`);
    const latestVersion = release.tag_name;
    const s2vExe = getS2vExePath();

    const cachedVersion = fs.existsSync(s2vVersionFile)
        ? fs.readFileSync(s2vVersionFile, 'utf8').trim()
        : null;

    if (cachedVersion === latestVersion && fs.existsSync(s2vExe)) {
        console.log(`Source2Viewer-CLI ${latestVersion} already cached`);
        return s2vExe;
    }

    const assetName = getS2vAssetName();
    const asset = release.assets.find(a => a.name === assetName);
    if (!asset) throw new Error(`Could not find ${assetName} in release assets`);

    console.log(`Downloading Source2Viewer-CLI ${latestVersion}${cachedVersion ? ` (was ${cachedVersion})` : ''}...`);

    const zipPath = path.join(s2vDir, 'cli.zip');
    await downloadFileHTTPS(asset.browser_download_url, zipPath);

    new AdmZip(zipPath).extractAllTo(s2vDir, true);
    fs.unlinkSync(zipPath);

    if (process.platform !== 'win32') {
        fs.chmodSync(s2vExe, 0o755);
    }

    fs.writeFileSync(s2vVersionFile, latestVersion);
    console.log(`Source2Viewer-CLI ${latestVersion} ready`);
    return s2vExe;
}

async function runSource2ViewerCLI(cliPath, vpkDirPath, outputDir, filter) {
    const tempOut = path.join(outputDir, '_temp_extract');
    fs.mkdirSync(tempOut, { recursive: true });

    await new Promise((resolve, reject) => {
        execFile(cliPath, [
            '-i', vpkDirPath,
            '-o', tempOut,
            '--vpk_filepath', filter,
            '-d',
        ], (err, stdout, stderr) => {
            if (err) return reject(new Error(stderr || err.message));
            resolve(stdout);
        });
    });

    function flattenDir(dir) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                flattenDir(fullPath);
            } else {
                const dest = path.join(outputDir, entry.name);
                fs.renameSync(fullPath, dest);
            }
        }
    }

    flattenDir(tempOut);
    fs.rmSync(tempOut, { recursive: true, force: true });
}

async function extractRadarsAndThumbs(vpkDirPath, radarFiles, thumbFiles, mapIconFiles) {
    const cliPath = await ensureSource2ViewerCLI();

    const knownMapNames = mapIconFiles
        .map(f => path.basename(f).match(/map_icon_(.+)\.vsvg_c$/i)?.[1])
        .filter(Boolean)
        .sort((a, b) => b.length - a.length);

    const radarMap = {};
    const thumbMap = {};

    if (radarFiles.length > 0) {
        console.log(`Extracting ${radarFiles.length} radar image(s)...`);
        await runSource2ViewerCLI(cliPath, vpkDirPath, radarDir, 'panorama/images/overheadmaps/');
        for (const vpkPath of radarFiles) {
            const baseName = path.basename(vpkPath, '.vtex_c');
            const mapName = knownMapNames.find(n => baseName === n || baseName.startsWith(n + '_'));
            if (!mapName) continue;
            const pngPath = path.join(radarDir, `${baseName}.png`);
            if (fs.existsSync(pngPath)) {
                if (!radarMap[mapName]) radarMap[mapName] = [];
                radarMap[mapName].push(`https://raw.githubusercontent.com/${repo}/${defaultBranch}/images/radars/${baseName}.png`);
            }
        }
    }

    if (thumbFiles.length > 0) {
        console.log(`Extracting ${thumbFiles.length} thumb image(s)...`);
        await runSource2ViewerCLI(cliPath, vpkDirPath, thumbDir, 'panorama/images/map_icons/screenshots/1080p/');
        for (const vpkPath of thumbFiles) {
            const baseName = path.basename(vpkPath, '.vtex_c');
            const mapName = knownMapNames.find(n => baseName === n || baseName.startsWith(n + '_'));
            if (!mapName) continue;
            const pngPath = path.join(thumbDir, `${baseName}.png`);
            if (fs.existsSync(pngPath)) {
                if (!thumbMap[mapName]) thumbMap[mapName] = [];
                thumbMap[mapName].push(`https://raw.githubusercontent.com/${repo}/${defaultBranch}/images/thumbs/${baseName}.png`);
            }
        }
    }

    return { radarMap, thumbMap };
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
    const mapIconFiles = Object.keys(vpkDir.tree).filter(fileName => mapIconRegex.test(fileName));
    const radarFiles = Object.keys(vpkDir.tree).filter(fileName => radarRegex.test(fileName));
    const thumbFiles = Object.keys(vpkDir.tree).filter(fileName => thumbRegex.test(fileName));

    const csgoEnglishFile = "resource/csgo_english.txt";
    if (vpkDir.tree[csgoEnglishFile]) {
        mapIconFiles.push(csgoEnglishFile);
    }

    return { mapIconFiles, radarFiles, thumbFiles, all: [...mapIconFiles, ...radarFiles, ...thumbFiles] };
}

function getRequiredVPKArchives(vpkDir, files) {
    const requiredIndices = new Set();
    for (const fileName of files) {
        const fileInfo = vpkDir.tree[fileName];
        if (fileInfo && fileInfo.archiveIndex !== undefined && fileInfo.archiveIndex !== 0x7fff) {
            requiredIndices.add(fileInfo.archiveIndex);
        }
    }
    return Array.from(requiredIndices).sort((a, b) => a - b);
}

async function downloadVPKArchives(user, manifest, vpkDir, files) {
    const requiredIndices = getRequiredVPKArchives(vpkDir, files);

    const toDownload = (await Promise.all(requiredIndices.map(async (archiveIndex) => {
        const paddedIndex = archiveIndex.toString().padStart(3, '0');
        const fileName = `pak01_${paddedIndex}.vpk`;
        const file = manifest.manifest.files.find(f => f.filename.endsWith(fileName));
        if (!file) return null;
        const filePath = path.join(temp, fileName);

        if (fs.existsSync(filePath)) {
            const localHash = crypto.createHash('sha1')
                .update(fs.readFileSync(filePath))
                .digest('hex');
            const manifestHash = file.sha_content?.toString('hex') ?? file.sha?.toString('hex');
            if (manifestHash && localHash === manifestHash) {
                console.log(`Skipping ${fileName} (hash matches)`);
                return null;
            }
            console.log(`Queued ${fileName} (hash mismatch)`);
        } else {
            console.log(`Queued ${fileName} (missing)`);
        }

        return { fileName, file, filePath };
    }))).filter(Boolean);

    if (toDownload.length === 0) {
        console.log('All VPK archives up to date.');
        return;
    }

    console.log(`Downloading ${toDownload.length} VPK archive(s)...`);
    let completed = 0;

    for (const { fileName, file, filePath } of toDownload) {
        const fileSize = parseInt(file.size, 10);
        const fileSizeMB = (fileSize / 1024 / 1024).toFixed(1);
        const start = Date.now();

        process.stdout.write(`[${completed + 1}/${toDownload.length}] ${fileName} (${fileSizeMB} MB)`);

        await user.downloadFile(appId, depotId, file, filePath);

        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        const speedMBs = (fileSize / 1024 / 1024 / parseFloat(elapsed)).toFixed(1);
        completed++;
        process.stdout.write(`\r✓ [${completed}/${toDownload.length}] ${fileName} (${fileSizeMB} MB) — ${elapsed}s @ ${speedMBs} MB/s\n`);
    }

    console.log(`Downloaded ${completed} VPK archive(s).`);
}

async function extractAndConvertMapIcons(vpkDir, files, radarMap, thumbMap, options = {}) {
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
        console.log(`Extracted ${mapName}`);
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

        if (radarMap[mapName]?.length) mapData.radar_paths = radarMap[mapName];
        if (thumbMap[mapName]?.length) mapData.thumb_paths = thumbMap[mapName];

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
    const fieldnames = ['map_name', 'display_name', 'hash', 'origin', 'path', 'radar_paths', 'thumb_paths'];
    const csvLines = [fieldnames.join(',')];
    for (const mapName of Object.keys(mergedMaps).sort()) {
        const d = mergedMaps[mapName];
        const row = [
            mapName,
            d.display_name || '',
            d.hash || '',
            d.origin || '',
            d.path || '',
            (d.radar_paths || []).join(';'),
            (d.thumb_paths || []).join(';'),
        ];
        csvLines.push(row.map(s => `"${s}"`).join(','));
    }
    fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf8');
    console.log('Dumped all data to available.csv');

    const mdPath = path.join(dataDir, 'available.md');
    const mdLines = [
        '| map_name | display_name | hash | origin | path | radar_paths | thumb_paths |',
        '|----------|--------------|------|--------|------|-------------|-------------|'
    ];
    for (const mapName of Object.keys(mergedMaps).sort()) {
        const d = mergedMaps[mapName];
        mdLines.push(`| ${mapName} | ${d.display_name || '-'} | ${d.hash || ''} | ${d.origin || ''} | ${d.path || ''} | ${(d.radar_paths || []).join('<br>') || '-'} | ${(d.thumb_paths || []).join('<br>') || '-'} |`);
    }
    fs.writeFileSync(mdPath, mdLines.join('\n'), 'utf8');
    console.log('Dumped all data to available.md');
}

[imagesDir, pngDir, radarDir, thumbDir, staticDir, dataDir, temp, s2vDir].forEach(dir => {
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
        const { mapIconFiles, radarFiles, thumbFiles, all } = getFiles(vpkDir);
        await downloadVPKArchives(user, manifest, vpkDir, all);
        const vpkDirPath = path.join(temp, 'pak01_dir.vpk');
        const { radarMap, thumbMap } = await extractRadarsAndThumbs(vpkDirPath, radarFiles, thumbFiles, mapIconFiles);
        const downloadedData = await extractAndConvertMapIcons(vpkDir, mapIconFiles, radarMap, thumbMap, options);
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