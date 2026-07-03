import os
import urllib.request

# Define sources for the files
FILES = ["train_FD001.txt", "test_FD001.txt", "RUL_FD001.txt"]

# List of mirror templates in order of preference
MIRRORS = [
    "https://raw.githubusercontent.com/edwardzjl/CMAPSSData/master/{file}",
    "https://raw.githubusercontent.com/bisheshs098/nasa-turbofan-engine-degradation-simulation/master/CMAPSSData/{file}",
    "https://raw.githubusercontent.com/jgomezm/C-MAPSS-Dataset-NASA/master/CMAPSSData/{file}",
    "https://raw.githubusercontent.com/sayan-ghosh/CMAPSS-dataset/master/{file}"
]

def download_dataset():
    # Target directory is the root 'data' folder
    target_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data"))
    os.makedirs(target_dir, exist_ok=True)
    
    print(f"Downloading files to: {target_dir}")
    
    for file_name in FILES:
        dest_path = os.path.join(target_dir, file_name)
        if os.path.exists(dest_path) and os.path.getsize(dest_path) > 0:
            print(f"{file_name} already exists and is not empty. Skipping.")
            continue
            
        success = False
        for mirror in MIRRORS:
            url = mirror.format(file=file_name)
            print(f"Trying to download {file_name} from: {url}")
            try:
                # Add headers to avoid user-agent blocking
                req = urllib.request.Request(
                    url, 
                    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
                )
                with urllib.request.urlopen(req, timeout=15) as response, open(dest_path, "wb") as out_file:
                    out_file.write(response.read())
                print(f"Successfully downloaded {file_name}")
                success = True
                break
            except Exception as e:
                print(f"Failed to download from {url} due to: {e}")
                
        if not success:
            raise RuntimeError(f"Could not download {file_name} from any mirrors. Please download it manually and place it in {target_dir}")

if __name__ == "__main__":
    download_dataset()
