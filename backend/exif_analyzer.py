from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS

def _parse_coord(value):
    """Convert a GPS coordinate tuple to decimal degrees."""
    try:
        def to_float(v):
            if isinstance(v, tuple):
                return v[0] / v[1] if v[1] != 0 else 0.0
            return float(v)
        d = to_float(value[0])
        m = to_float(value[1])
        s = to_float(value[2])
        return d + m / 60 + s / 3600
    except Exception:
        return None

def _get_gps_string(gps_info):
    try:
        decoded = {GPSTAGS.get(k, k): v for k, v in gps_info.items()}

        lat_val = decoded.get("GPSLatitude")
        lat_ref = decoded.get("GPSLatitudeRef", "N")
        lon_val = decoded.get("GPSLongitude")
        lon_ref = decoded.get("GPSLongitudeRef", "E")

        if lat_val is None or lon_val is None:
            return None

        lat = _parse_coord(lat_val)
        lon = _parse_coord(lon_val)

        if lat is None or lon is None:
            return None

        if lat_ref == "S":
            lat = -lat
        if lon_ref == "W":
            lon = -lon

        return f"{lat:.6f}, {lon:.6f}"
    except Exception:
        return None

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
        make = str(tag_names.get("Make", "")).strip()
        model = str(tag_names.get("Model", "")).strip()
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
        if not raw_gps:
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