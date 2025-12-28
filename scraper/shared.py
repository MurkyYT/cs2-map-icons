from threading import Lock
from loguru import logger

import os

file_lock = Lock()
print_lock = Lock()
data_lock = Lock()

map_icons = {}

repo = os.getenv("GITHUB_REPOSITORY", "MurkyYT/cs2-map-icons")
default_branch = os.getenv("DEFAULT_BRANCH", "main")

repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))