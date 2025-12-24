from playwright.sync_api import sync_playwright
from threading import Lock
import os
import requests
import sys

map_icons = {}
client_lock = Lock()

def is_official(map_name):
    return map_name.lower()[0:3] in ["de_", "dz_", "gd_", "cs_", "ar_"]

def download_image(url, filename):
    """Download image from URL and save to images folder"""
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        
        images_dir = os.path.join(os.path.dirname(__file__), '..', 'images')
        os.makedirs(images_dir, exist_ok=True)
        
        filepath = os.path.join(images_dir, filename)
        
        with open(filepath, 'wb') as f:
            f.write(response.content)
        
        print(f"✓ Downloaded: {filename}")
        return True
    except Exception as e:
        print(f"✗ Failed to download {filename}: {e}")
        return False

def load_map_icons():
    with client_lock:
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(
                    headless=True,
                    args=[
                        '--disable-blink-features=AutomationControlled',
                        '--no-sandbox',
                        '--disable-web-security'
                    ]
                )
                
                context = browser.new_context(
                    user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    viewport={'width': 1920, 'height': 1080}
                )
                
                page = context.new_page()
                
                page.add_init_script("""
                    Object.defineProperty(navigator, 'webdriver', {
                        get: () => undefined
                    });
                """)
                
                page.goto("https://developer.valvesoftware.com/wiki/Counter-Strike_2/Maps", 
                         wait_until="networkidle",
                         timeout=30000)
                
                page.wait_for_timeout(8000)
                
                info = page.content()
                browser.close()
            
            splt = info.split('src="/w/images/thumb/')
            
            for i in range(1, len(splt)):
                link = splt[i].split('"')[0]
                
                try:
                    is_new = False
                    image_info = link.split('/')
                    map_name = image_info[2].split('.')[0]
                    
                    if map_name.startswith("Map_icon_"):
                        map_name = map_name[len("Map_icon_"):]
                        is_new = True
                    
                    map_name = map_name.lower()
                    
                    if is_official(map_name):
                        if not is_new and map_name in map_icons:
                            continue
                        
                        final_link = f"https://developer.valvesoftware.com/w/images/{image_info[0]}/{image_info[1]}/{image_info[2]}"
                        map_icons[map_name] = final_link
                        print(f"✓ Found icon for {map_name}: {final_link}")
                        
                except Exception:
                    pass
                    
        except Exception as e:
            print(f"Error: {e}")
            sys.exit(1)

def download_all_icons():
    """Download all found map icons"""
    print("\n=== Downloading Map Icons ===")
    
    if not map_icons:
        print("No map icons found!")
        return
    
    for map_name, icon_url in map_icons.items():
        file_ext = icon_url.split('.')[-1]
        filename = f"{map_name}.{file_ext}"
        
        download_image(icon_url, filename)

if __name__ == "__main__":
    print("=== Finding Map Icons ===")
    load_map_icons()
    
    print(f"\n=== Found {len(map_icons)} Map Icons ===")
    for map_name, icon_url in map_icons.items():
        print(f"{map_name}: {icon_url}")
    
    download_all_icons()
    
    images_dir = os.path.join(os.path.dirname(__file__), '..', 'images')
    print(f"\n✓ Complete! Images saved to: {os.path.abspath(images_dir)}")