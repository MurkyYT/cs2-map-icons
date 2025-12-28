from playwright.sync_api import sync_playwright
import os
import requests
import sys
import json
import time
import hashlib
import csv
from loguru import logger
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock

map_icons = {}
file_lock = Lock()
print_lock = Lock()
data_lock = Lock()

repo = os.getenv("GITHUB_REPOSITORY", "MurkyYT/cs2-map-icons")
default_branch = os.getenv("DEFAULT_BRANCH", "main")

def is_official(map_name):
    return map_name.lower()[0:3] in ["de_", "dz_", "gd_", "cs_", "ar_"]

def get_remote_file_hash(url, session):
    try:
        response = session.head(url, timeout=2, allow_redirects=True)
        
        if 'ETag' in response.headers:
            return response.headers['ETag'].strip('"')
        
        last_modified = response.headers.get('Last-Modified', '')
        content_length = response.headers.get('Content-Length', '')
        
        if last_modified or content_length:
            return hashlib.md5(f"{last_modified}:{content_length}".encode()).hexdigest()
        
        response = session.get(url, timeout=2)
        response.raise_for_status()
        return hashlib.md5(response.content).hexdigest()
        
    except Exception as e:
        with print_lock:
            logger.info(f"Failed to get hash for {url}: {e}")
        return None

def load_existing_data():
    logger.info("Loading existing maps data...")
    try:
        repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        json_path = os.path.join(repo_root, "available.json")
        
        if os.path.exists(json_path):
            with open(json_path, "r") as f:
                return json.load(f)
    except Exception as e:
        logger.info(f"Could not load existing data: {e}")
    
    return {"count": 0, "maps": {}}

def download_image(url, filename, existing_hash, session):
    try:
        images_dir = os.path.join(os.path.dirname(__file__), "..", "images")
        filepath = os.path.join(images_dir, filename)
        
        file_exists = os.path.exists(filepath)
        
        remote_hash = get_remote_file_hash(url, session)
        
        if remote_hash and existing_hash and remote_hash == existing_hash and file_exists:
            with print_lock:
                logger.debug(f"Skipped: {filename}")
            return True, remote_hash, filename
        
        response = session.get(url, timeout=3)
        response.raise_for_status()
        
        with file_lock:
            os.makedirs(images_dir, exist_ok=True)
            with open(filepath, "wb") as f:
                f.write(response.content)

        content_hash = hashlib.md5(response.content).hexdigest()

        status = "Updated" if existing_hash else "Downloaded"
        with print_lock:
            logger.debug(f"{status}: {filename}")
        return True, remote_hash or content_hash, filename
        
    except Exception as e:
        with print_lock:
            logger.warning(f"Failed: {filename}: {e}")
        return False, None, filename

def load_map_icons():
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--no-sandbox",
                    "--disable-web-security",
                ],
            )

            context = browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                           "AppleWebKit/537.36 (KHTML, like Gecko) "
                           "Chrome/120.0.0.0 Safari/537.36",
                viewport={"width": 1200, "height": 800},
            )

            page = context.new_page()

            page.add_init_script(
                """
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined
                });
                """
            )

            logger.info("Loading website...")

            start_time = time.time()
            page.goto(
                "https://developer.valvesoftware.com/wiki/Counter-Strike_2/Maps",
                wait_until="networkidle",
                timeout=20000,
            )
            end_time = time.time()

            logger.debug(f"Loaded in {end_time - start_time:.2f}s")

            page.wait_for_selector('img[src*="Map_icon_"]', timeout=10000)
            html = page.content()
            browser.close()

        splt = html.split('src="/w/images/thumb/')

        for i in range(1, len(splt)):
            link = splt[i].split('"')[0]

            try:
                is_new = False
                image_info = link.split("/")
                map_name = image_info[2].split(".")[0]

                if map_name.startswith("Map_icon_"):
                    map_name = map_name[len("Map_icon_") :]
                    is_new = True

                map_name = map_name.lower()

                if is_official(map_name):
                    if not is_new and map_name in map_icons:
                        continue

                    final_link = f"https://developer.valvesoftware.com/w/images/{image_info[0]}/{image_info[1]}/{image_info[2]}"
                    map_icons[map_name] = final_link
                    logger.debug(f"Found: {map_name}")

            except Exception:
                continue

    except Exception as e:
        logger.error(f"Error: {e}")
        sys.exit(1)

def process_map(args):
    map_name, icon_url, existing_hash, session = args
    file_ext = icon_url.split(".")[-1]
    filename = f"{map_name}.{file_ext}"
    
    success, file_hash, _ = download_image(icon_url, filename, existing_hash, session)
    
    if success:
        prefix = f"https://raw.githubusercontent.com/{repo}/{default_branch}/" if repo is not None and default_branch is not None else ""

        return (map_name, {
            "path": f"{prefix}images/{filename}",
            "origin": icon_url,
            "hash": file_hash,
        })
    return None

def download_all_icons(existing_data):
    if not map_icons:
        logger.info("No icons found!")
        return {}

    existing_maps = existing_data.get("maps", {})

    logical_cpus = os.cpu_count() or 4
    max_workers = logical_cpus * 4

    session = requests.Session()
    adapter = requests.adapters.HTTPAdapter(
        pool_connections=max_workers,
        pool_maxsize=max_workers * 2,
        max_retries=1,
        pool_block=False
    )
    session.mount('http://', adapter)
    session.mount('https://', adapter)

    downloaded_data = {}
    
    try:
        tasks = []
        for map_name, icon_url in map_icons.items():
            existing_hash = existing_maps.get(map_name, {}).get("hash")
            tasks.append((map_name, icon_url, existing_hash, session))
        
        logger.info(
            f"Running with {max_workers} worker threads "
            f"({logical_cpus} logical CPUs)"
        )
        
        with ThreadPoolExecutor(max_workers=logical_cpus) as executor:
            futures = {executor.submit(process_map, task): task for task in tasks}
            
            for future in as_completed(futures):
                result = future.result()
                if result:
                    map_name, data = result
                    with data_lock:
                        downloaded_data[map_name] = data
                    
    finally:
        session.close()

    return downloaded_data

def dump_available_maps(downloaded_data, existing_data):

    merged_maps = existing_data.get("maps", {}).copy()

    for map_name in merged_maps:
        if map_name not in downloaded_data:
            merged_maps[map_name]["origin"] = ""
    
    merged_maps.update(downloaded_data)

    available_maps = {
        "count": len(merged_maps),
        "maps": merged_maps
    }

    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    json_path = os.path.join(repo_root, "available.json")
    csv_path = os.path.join(repo_root, "available.csv")
    md_path = os.path.join(repo_root, "available.md")

    with open(json_path, "w") as f:
        json.dump(available_maps, f, indent=4, sort_keys=True)
    logger.info("Dumped all data to available.json")

    fieldnames = ["map_name", "hash", "origin", "path"]
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        for map_name, map_data in sorted(merged_maps.items()):
            writer.writerow({
                "map_name": map_name,
                "hash": map_data.get("hash"),
                "origin": map_data.get("origin"),
                "path": map_data.get("path"),
            })
    logger.info("Dumped all data to available.csv")

    with open(md_path, "w", encoding="utf-8") as f:
        f.write("| map_name | hash | origin | path |\n")
        f.write("|----------|------|--------|------|\n")
        for name, d in sorted(merged_maps.items()):
            f.write(f"| {name} | {d['hash']} | {d['origin']} | {d['path']} |\n")
    logger.info("Dumped all data to available.md")

def main():
    if repo:
        logger.debug(f"Repo path: {repo}")
    else:
        logger.warning("No repo path found")
    
    if default_branch:
        logger.debug(f"Default branch: {default_branch}")
    else:
        logger.warning("No default branch found")

    existing_data = load_existing_data()
    logger.info(f"Loaded {existing_data.get('count', 0)} existing map(s)")
    
    logger.info("=== Finding Icons ===")
    load_map_icons()
    logger.info(f"Found {len(map_icons)} icons")

    logger.info("=== Updating map Icons ===")
    downloaded_data = download_all_icons(existing_data)
    logger.info(f"Complete")

    dump_available_maps(downloaded_data, existing_data)

if __name__ == "__main__":
    main()