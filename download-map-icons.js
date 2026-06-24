const fs = require('fs');
const vpk = require('./vpk-no-request');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const SteamUser = require('steam-user');
const { execFile, execSync } = require('child_process');
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
const radarInfoDir = path.join(dataDir, 'radar_info');
const thumbDir = path.join(imagesDir, 'thumbs');
const s2vDir = './s2v';
const depotDownloaderDir = './depot-downloader';
const s2vVersionFile = path.join(s2vDir, 'version.txt');
const depotDownloaderVersionFile = path.join(depotDownloaderDir, 'version.txt');
const manifestFile = path.join(staticDir, 'manifest.txt');
const changelogFile = './CHANGELOG.md';
const mapIconRegex = /^panorama\/images\/map_icons\/map_icon_.*\.vsvg_c$/i;
const radarRegex = /^panorama\/images\/overheadmaps\/.*\.vtex_c$/i;
const radarInfoRegex = /^resource\/overviews\/.+\.txt$/i;
const thumbRegex = /^panorama\/images\/map_icons\/screenshots\/1080p\/.*\.vtex_c$/i;
const repo = process.env.GITHUB_REPOSITORY || "MurkyYT/cs2-map-icons";
const defaultBranch = process.env.DEFAULT_BRANCH || "main";
const S2V_REPO = 'ValveResourceFormat/ValveResourceFormat';
const DEPOT_DOWNLOADER_REPO = 'SteamRE/DepotDownloader';

const options = {
    width: 512,
    height: 512,
    backgroundColor: 'transparent'
};

function getDepotDownloaderAssetName() {
    switch (process.platform) {
        case 'win32':  return 'DepotDownloader-windows-x64.zip';
        case 'darwin': return 'DepotDownloader-osx-x64.zip';
        default:       return 'DepotDownloader-linux-x64.zip';
    }
}

function getDepotDownloaderExePath() {
    const exe = process.platform === 'win32' ? 'DepotDownloader.exe' : 'DepotDownloader';
    return path.join(depotDownloaderDir, exe);
}

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

async function ensureDepotDownloader() {
    if (!fs.existsSync(depotDownloaderDir)) fs.mkdirSync(depotDownloaderDir, { recursive: true });

    const release = await fetchJson(`https://api.github.com/repos/${DEPOT_DOWNLOADER_REPO}/releases/latest`);
    const latestVersion = release.tag_name;
    const ddExe = getDepotDownloaderExePath();

    const cachedVersion = fs.existsSync(depotDownloaderVersionFile)
        ? fs.readFileSync(depotDownloaderVersionFile, 'utf8').trim()
        : null;

    if (cachedVersion === latestVersion && fs.existsSync(ddExe)) {
        console.log(`DepotDownloader ${latestVersion} already cached`);
        return ddExe;
    }

    const assetName = getDepotDownloaderAssetName();
    const asset = release.assets.find(a => a.name === assetName);
    if (!asset) throw new Error(`Could not find ${assetName} in release assets`);

    console.log(`Downloading DepotDownloader ${latestVersion}${cachedVersion ? ` (was ${cachedVersion})` : ''}...`);

    const zipPath = path.join(depotDownloaderDir, 'dd.zip');
    await downloadFileHTTPS(asset.browser_download_url, zipPath);

    new AdmZip(zipPath).extractAllTo(depotDownloaderDir, true);
    fs.unlinkSync(zipPath);

    if (process.platform !== 'win32') {
        fs.chmodSync(ddExe, 0o755);
    }

    fs.writeFileSync(depotDownloaderVersionFile, latestVersion);
    console.log(`DepotDownloader ${latestVersion} ready`);
    return ddExe;
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

async function downloadVPKFiles(depotDownloaderPath) {
    console.log(`\n[Stage 1/2] Downloading pak01_dir.vpk to determine required archives...`);
    await runDepotDownloader(depotDownloaderPath, ['game/csgo/pak01_dir.vpk']);
    
    const vpkDirPath = path.join(temp, 'game', 'csgo', 'pak01_dir.vpk');
    if (!fs.existsSync(vpkDirPath)) {
        throw new Error(`pak01_dir.vpk not found at ${vpkDirPath}`);
    }

    const vpkDir = new vpk(vpkDirPath);
    vpkDir.load();
    
    const { mapIconFiles, radarFiles, radarInfoFiles, thumbFiles, all } = getFiles(vpkDir);
    const requiredArchives = getRequiredVPKArchives(vpkDir, all);
    
    console.log(`\nFound files to extract:`);
    console.log(`  - ${mapIconFiles.length} map icons`);
    console.log(`  - ${radarFiles.length} radars`);
    console.log(`  - ${radarInfoFiles.length} radar info files`);
    console.log(`  - ${thumbFiles.length} thumbnails`);
    
    console.log(`\nRequired VPK archives: ${requiredArchives.map(i => `pak01_${String(i).padStart(3, '0')}.vpk`).join(', ')}`);
    
    if (requiredArchives.length === 0) {
        console.log('No additional archives needed.');
        return vpkDir;
    }

    const fileList = requiredArchives
        .map(i => `game/csgo/pak01_${String(i).padStart(3, '0')}.vpk`)
        .concat(['game/csgo/pak01_dir.vpk']);

    console.log(`\n[Stage 2/2] Downloading ${requiredArchives.length} VPK archive(s)...`);
    await runDepotDownloader(depotDownloaderPath, fileList);
    
    return vpkDir;
}

async function runDepotDownloader(depotDownloaderPath, fileList) {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(temp)) {
            fs.mkdirSync(temp, { recursive: true });
        }

        const args = [
            '-app', appId.toString(),
            '-depot', depotId.toString(),
            '-os', 'windows',
            '-dir', temp
        ];

        const fileListContent = fileList.join('\n');
        const fileListPath = path.join(temp, 'filelist.txt');
        fs.writeFileSync(fileListPath, fileListContent, 'utf8');
        
        console.log(`Files to download:\n${fileList.map(f => `  ${f}`).join('\n')}`);
        console.log(`\nFile list written to: ${fileListPath}`);
        console.log(`File list content:\n${fileListContent}\n`);
        
        args.push('-filelist');
        args.push(fileListPath);

        console.log(`Command: ${depotDownloaderPath} ${args.join(' ')}\n`);
        
        const child = require('child_process').spawn(depotDownloaderPath, args, {
            stdio: ['pipe', 'inherit', 'inherit']
        });

        child.stdin.write('\n');
        child.stdin.end();

        child.on('error', (err) => {
            reject(new Error(`Failed to execute DepotDownloader: ${err.message}`));
        });

        child.on('close', (code) => {
            try {
                fs.unlinkSync(fileListPath);
            } catch { }
            
            if (code !== 0) {
                reject(new Error(`DepotDownloader exited with code ${code}`));
            } else {
                console.log('\nDepotDownloader stage completed');
                resolve();
            }
        });
    });
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
            } else if (entry.name.endsWith('.png')) {
                const dest = path.join(outputDir, entry.name);
                fs.renameSync(fullPath, dest);
            } else {
                fs.unlinkSync(fullPath);
            }
        }
    }

    flattenDir(tempOut);
    fs.rmSync(tempOut, { recursive: true, force: true });
}

function parseRadarInfo(content) {
    const result = {};
    const stripComments = content.replace(/\/\/[^\n]*/g, '');

    const floatVal = (key) => {
        const m = stripComments.match(new RegExp(`"${key}"\\s+"?([\\-\\d.]+)"?`));
        return m ? parseFloat(m[1]) : undefined;
    };

    for (const key of ['pos_x', 'pos_y', 'scale', 'rotate', 'zoom']) {
        const val = floatVal(key);
        if (val !== undefined) result[key] = val;
    }

    const verticalMatch = stripComments.match(/"verticalsections"\s*\{([^}]+)\}/s);
    if (verticalMatch) {
        const sections = {};
        const sectionRegex = /"(\w+)"\s*\{([^}]+)\}/gs;
        let sec;
        while ((sec = sectionRegex.exec(verticalMatch[1])) !== null) {
            const name = sec[1];
            const body = sec[2];
            const altMax = body.match(/"AltitudeMax"\s+"?([\-\d.]+)"?/);
            const altMin = body.match(/"AltitudeMin"\s+"?([\-\d.]+)"?/);
            sections[name] = {
                ...(altMax ? { AltitudeMax: parseFloat(altMax[1]) } : {}),
                ...(altMin ? { AltitudeMin: parseFloat(altMin[1]) } : {}),
            };
        }
        if (Object.keys(sections).length > 0) result.verticalsections = sections;
    }

    return result;
}

function extractRadarInfo(vpkDir, radarInfoFiles, knownMapNames) {
    if (!fs.existsSync(radarInfoDir)) fs.mkdirSync(radarInfoDir, { recursive: true });

    const radarInfoMap = {};

    for (const vpkPath of radarInfoFiles) {
        const buffer = vpkDir.getFile(vpkPath);
        const fileName = path.basename(vpkPath);
        const mapName = fileName.replace(/\.txt$/i, '');

        if (!knownMapNames.includes(mapName)) continue;

        fs.writeFileSync(path.join(radarInfoDir, fileName), buffer);
        console.log(`Extracted radar info: ${fileName}`);

        const parsed = parseRadarInfo(buffer.toString('utf8'));
        if (Object.keys(parsed).length > 0) {
            radarInfoMap[mapName] = {
                path: `https://raw.githubusercontent.com/${repo}/${defaultBranch}/data/radar_info/${fileName}`,
                ...parsed,
            };
        }
    }

    return radarInfoMap;
}

function getMapFirstSeenDates() {
    const firstSeen = {};
    try {
        const log = execSync('git log --pretty=format:"%H %ai" -- data/available.json', { encoding: 'utf8' });
        if (!log.trim()) return firstSeen;

        const commits = log.trim().split('\n').map(line => {
            const spaceIdx = line.indexOf(' ');
            return { hash: line.slice(0, spaceIdx), date: line.slice(spaceIdx + 1, spaceIdx + 11) };
        }).reverse();

        for (const { hash, date } of commits) {
            try {
                const json = JSON.parse(execSync(`git show ${hash}:data/available.json`, { encoding: 'utf8' }));
                for (const mapName of Object.keys(json.maps || {})) {
                    if (!firstSeen[mapName]) firstSeen[mapName] = date;
                }
            } catch {
            }
        }
    } catch {
    }
    return firstSeen;
}

function generateChangelog(oldData, newData) {
    const oldMaps = oldData.maps || {};
    const newMaps = newData.maps || {};
    const date = new Date().toISOString().slice(0, 10);

    const added   = Object.keys(newMaps).filter(m => !oldMaps[m]);
    const removed = Object.keys(oldMaps).filter(m => !newMaps[m]);
    const updated = Object.keys(newMaps).filter(m =>
        oldMaps[m] && oldMaps[m].hash && newMaps[m].hash && oldMaps[m].hash !== newMaps[m].hash
    );

    if (!added.length && !updated.length && !removed.length) {
        console.log('No map changes — skipping changelog');
        return null;
    }

    const lines = [`## ${date}\n`];
    if (added.length)   lines.push(`### Added\n${added.map(m => `- \`${m}\``).join('\n')}\n`);
    if (updated.length) lines.push(`### Updated\n${updated.map(m => `- \`${m}\``).join('\n')}\n`);
    if (removed.length) lines.push(`### Removed\n${removed.map(m => `- \`${m}\``).join('\n')}\n`);

    const existing = fs.existsSync(changelogFile) ? fs.readFileSync(changelogFile, 'utf8') : '';
    const header = existing.startsWith('# Changelog') ? '' : '# Changelog\n\n';
    fs.writeFileSync(changelogFile, header + lines.join('\n') + '\n' + existing.replace(/^# Changelog\n\n?/, ''));
    console.log('Updated CHANGELOG.md');

    return { date, added, updated, removed };
}

async function publishGitHubRelease(manifestId, changes) {
    if (!changes) return;

    const token = process.env.GITHUB_TOKEN;
    if (!token) {
        console.log('No GITHUB_TOKEN — skipping release');
        return;
    }

    const { date, added, updated, removed } = changes;

    const bodyParts = [
        added.length   ? `### Added\n${added.map(m => `- \`${m}\``).join('\n')}` : null,
        updated.length ? `### Updated\n${updated.map(m => `- \`${m}\``).join('\n')}` : null,
        removed.length ? `### Removed\n${removed.map(m => `- \`${m}\``).join('\n')}` : null,
    ].filter(Boolean);

    const payload = JSON.stringify({
        tag_name: `update-${date}-${manifestId.slice(-6)}`,
        name: `Map update ${date}`,
        body: bodyParts.join('\n\n'),
        draft: false,
        prerelease: false,
    });

    await new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'api.github.com',
            path: `/repos/${repo}/releases`,
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'User-Agent': 'cs2-map-icons',
                'Content-Length': Buffer.byteLength(payload),
            },
        }, res => {
            res.resume();
            if (res.statusCode === 201) {
                console.log(`Published GitHub release for manifest ${manifestId}`);
                resolve();
            } else {
                reject(new Error(`GitHub release failed: ${res.statusCode}`));
            }
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
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

function getFiles(vpkDir) {
    const mapIconFiles = Object.keys(vpkDir.tree).filter(fileName => mapIconRegex.test(fileName));
    const radarFiles = Object.keys(vpkDir.tree).filter(fileName => radarRegex.test(fileName));
    const radarInfoFiles = Object.keys(vpkDir.tree).filter(fileName => radarInfoRegex.test(fileName));
    const thumbFiles = Object.keys(vpkDir.tree).filter(fileName => thumbRegex.test(fileName));

    const csgoEnglishFile = "resource/csgo_english.txt";
    if (vpkDir.tree[csgoEnglishFile]) {
        mapIconFiles.push(csgoEnglishFile);
    }

    return { mapIconFiles, radarFiles, radarInfoFiles, thumbFiles, all: [...mapIconFiles, ...radarFiles, ...radarInfoFiles, ...thumbFiles] };
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

async function extractAndConvertMapIcons(vpkDir, files, radarMap, thumbMap, radarInfoMap, firstSeenDates, options = {}) {
    let useSharp = false;
    try { require('sharp'); useSharp = true; } catch { }
    const converter = new VsvgConverter({ useSharp });
    const downloadedData = {};
    const existingData = loadExistingData();
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

        mapData.first_seen =
            firstSeenDates[mapName] ||
            existingData.maps[mapName]?.first_seen ||
            new Date().toISOString().slice(0, 10);

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
        else if (existingData.maps[mapName]?.radar_paths) mapData.radar_paths = existingData.maps[mapName].radar_paths;

        if (radarInfoMap[mapName]) mapData.radar_info = radarInfoMap[mapName];
        else if (existingData.maps[mapName]?.radar_info) mapData.radar_info = existingData.maps[mapName].radar_info;

        if (thumbMap[mapName]?.length) mapData.thumb_paths = thumbMap[mapName];
        else if (existingData.maps[mapName]?.thumb_paths) mapData.thumb_paths = existingData.maps[mapName].thumb_paths;

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
    const fieldnames = ['map_name', 'display_name', 'hash', 'first_seen', 'origin', 'path', 'radar_paths', 'radar_info', 'thumb_paths'];
    const csvLines = [fieldnames.join(',')];
    for (const mapName of Object.keys(mergedMaps).sort()) {
        const d = mergedMaps[mapName];
        const row = [
            mapName,
            d.display_name || '',
            d.hash || '',
            d.first_seen || '',
            d.origin || '',
            d.path || '',
            (d.radar_paths || []).join(';'),
            d.radar_info ? JSON.stringify(d.radar_info) : '',
            (d.thumb_paths || []).join(';'),
        ];
        csvLines.push(row.map(s => `"${String(s).replace(/"/g, '""')}"`).join(','));
    }
    fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf8');
    console.log('Dumped all data to available.csv');

    const mdPath = path.join(dataDir, 'available.md');
    const mdLines = [
        '| map_name | display_name | hash | first_seen | origin | path | radar_paths | radar_info | thumb_paths |',
        '|----------|--------------|------|------------|--------|------|-------------|------------|-------------|'
    ];
    for (const mapName of Object.keys(mergedMaps).sort()) {
        const d = mergedMaps[mapName];
        const radarInfoStr = d.radar_info
            ? `[txt](${d.radar_info.path}) pos_x:${d.radar_info.pos_x} pos_y:${d.radar_info.pos_y} scale:${d.radar_info.scale}`
            : '-';
        mdLines.push(`| ${mapName} | ${d.display_name || '-'} | ${d.hash || ''} | ${d.first_seen || '-'} | ${d.origin || ''} | ${d.path || ''} | ${(d.radar_paths || []).join('<br>') || '-'} | ${radarInfoStr} | ${(d.thumb_paths || []).join('<br>') || '-'} |`);
    }
    fs.writeFileSync(mdPath, mdLines.join('\n'), 'utf8');
    console.log('Dumped all data to available.md');
}

[imagesDir, pngDir, radarDir, radarInfoDir, thumbDir, staticDir, dataDir, temp, s2vDir, depotDownloaderDir].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

async function getLatestManifestId() {
    return new Promise((resolve, reject) => {
        const user = new SteamUser();

        user.on('error', (err) => reject(err));

        user.logOn({ anonymous: true });

        user.once('loggedOn', async () => {
            try {
                const cs = (await user.getProductInfo([appId], [], true)).apps[appId].appinfo;
                const commonDepot = cs.depots[depotId];
                const latestManifestId = commonDepot.manifests.public.gid;
                console.log("Got manifest id " + latestManifestId);
                user.logOff();
                resolve(latestManifestId);
            } catch (err) {
                user.logOff();
                reject(err);
            }
        });
    });
}

(async () => {
    try {
        const latestManifestId = await getLatestManifestId();
        const lastManifestId = readLastManifestId();

        if (lastManifestId === latestManifestId) {
            console.log('Manifest unchanged — skipping download');
            process.exit(0);
        }

        console.log(`Manifest changed: ${lastManifestId || '(none)'} -> ${latestManifestId}`);

        const ddPath = await ensureDepotDownloader();
        const vpkDir = await downloadVPKFiles(ddPath);

        const { mapIconFiles, radarFiles, radarInfoFiles, thumbFiles, all } = getFiles(vpkDir);
        const vpkDirPath = path.join(temp, 'game', 'csgo', 'pak01_dir.vpk');

        const { radarMap, thumbMap } = await extractRadarsAndThumbs(vpkDirPath, radarFiles, thumbFiles, mapIconFiles);

        const knownMapNames = mapIconFiles
            .map(f => path.basename(f).match(/map_icon_(.+)\.vsvg_c$/i)?.[1])
            .filter(Boolean);

        const radarInfoMap = extractRadarInfo(vpkDir, radarInfoFiles, knownMapNames);
        const firstSeenDates = getMapFirstSeenDates();
        const oldData = loadExistingData();
        const downloadedData = await extractAndConvertMapIcons(vpkDir, mapIconFiles, radarMap, thumbMap, radarInfoMap, firstSeenDates, options);
        
        generateDataFiles(downloadedData);
        const newData = loadExistingData();
        const changes = generateChangelog(oldData, newData);
        
        await publishGitHubRelease(latestManifestId, changes);
        writeManifestId(latestManifestId);
        
        console.log("Done!");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();