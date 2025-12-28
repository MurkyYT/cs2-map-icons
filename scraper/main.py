from shared import *
from web_scraper import *
from data_modifier import *

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