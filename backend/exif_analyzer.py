from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS

def _get_gps_string(gps_info):
    try:
        def to_deg(val):
            d, m, s = val
            return float(d) + float(m) / 60 + float(s) / 3600

        lat = to_deg(gps_info.get(2, ((0,1),(0,1),(0,1))))
        lat_ref = gps_info.get(1, "N")
        lon = to_deg(gps_info.get(4, ((0,1),(0,1),(0,1))))
        lon_ref = gps_info.get(3, "E")

        lat_val = -lat if lat_ref == "S" else lat
        lon_val = -lon if lon_ref == "W" else lon

        return f"{lat_val:.6f}, {lon_val:.6f}"
    except Exception:
        return "Present"

def analyze_exif(image_path: str) -> dict:
    flags = []
    values = {}

    try:
        img = Image.open(image_path)
        exif_data = img._getexif() if hasattr(img, "_getexif") else None

        if not exif_data:
            flags.append("No EXIF data found")
            return {"flags": flags, "values": values}

        tag_names = {TAGS.get(k, k): v for k, v in exif_data.items()}

        # Camera model
        make = tag_names.get("Make", "")
        model = tag_names.get("Model", "")
        if make or model:
            values["camera"] = f"{make} {model}".strip()
        else:
            flags.append("No camera make or model found")

        # Timestamp
        timestamp = tag_names.get("DateTimeOriginal") or tag_names.get("DateTime")
        if timestamp:
            values["timestamp"] = str(timestamp)
        else:
            flags.append("No original capture timestamp")

        # GPS
        raw_gps = tag_names.get("GPSInfo")
        if raw_gps:
            values["gps"] = _get_gps_string(raw_gps)
        else:
            flags.append("No GPS metadata")

        # Software
        software = tag_names.get("Software")
        if software:
            flags.append(f"Edited with software: {software}")
            values["software"] = str(software)

        if not flags:
            flags.append("No suspicious metadata flags found")

    except Exception as e:
        flags.append(f"Could not read metadata: {str(e)}")

    return {"flags": flags, "values": values}