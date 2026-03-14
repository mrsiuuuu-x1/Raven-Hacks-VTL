from PIL import Image
from PIL.ExifTags import TAGS

def analyze_exif(image_path: str) -> list:
    flags = []
    try:
        img = Image.open(image_path)
        exif_data = img.__getexif()

        if not exif_data:
            flags.append("No EXIF data found")
            return flags
        
        tag_names = {TAGS.get(k,k): v for k, v in exif_data.items()}

        if "GPSInfo" not in tag_names:
            flags.append("No GPS metadata")
        
        if "DataTimeOriginal" not in tag_names:
            flags.append("No original capture timestamp")

        if "Make" not in tag_names and "Model" not in tag_names:
            flags.append("No camera make or modelfound")

        if "Software" in tag_names:
            flags.append(f"Edited with software: {tag_names['Software']}")
        
        if not flags:
            flags.append("No suspicious metadata flags found")
    except Exception as e:
        flags.append(f"Could not read metadata: {str(e)}")
    return flags