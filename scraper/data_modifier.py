import os, json, csv

from shared import *

data_dir = os.path.join(repo_root , "data")

def dump_available_maps(downloaded_data: dict, existing_data: dict):
    merged_maps: dict = existing_data.get("maps", {}).copy()

    for map_name in merged_maps:
        if map_name not in downloaded_data:
            merged_maps[map_name]["origin"] = ""
    
    merged_maps.update(downloaded_data)

    available_maps = {
        "count": len(merged_maps),
        "maps": merged_maps
    }

    json_path = os.path.join(data_dir, "available.json")
    csv_path = os.path.join(data_dir, "available.csv")
    md_path = os.path.join(data_dir, "available.md")

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

def load_existing_data():
    logger.info("Loading existing maps data...")
    try:
        json_path = os.path.join(data_dir, "available.json")
        
        if os.path.exists(json_path):
            with open(json_path, "r") as f:
                return json.load(f)
    except Exception as e:
        logger.info(f"Could not load existing data: {e}")
    
    return {"count": 0, "maps": {}}