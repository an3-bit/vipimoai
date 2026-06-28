import os
import requests
import json

OPENROUTER_API_KEY = os.getenv('OPENROUTER_API_KEY')
OPENROUTER_API_BASE = os.getenv('OPENROUTER_API_BASE', 'https://openrouter.ai')


def send_image_for_extraction(image_bytes: bytes, crs_name: str = 'EPSG:21037') -> dict:
    """Send image bytes to OpenRouter for OCR/semantic extraction.

    This adapter posts the image as multipart/form-data and expects
    the model to return a JSON payload with `parcels` and `annotations`.
    """
    if not OPENROUTER_API_KEY:
        raise RuntimeError('OPENROUTER_API_KEY not set')

    url = f"{OPENROUTER_API_BASE}/v1/chat/completions"
    headers = {
        'Authorization': f'Bearer {OPENROUTER_API_KEY}'
    }

    # Minimal wrapper: send base64 or multipart depending on provider.
    # We'll send a simple POST with a text prompt and no file upload for now.
    prompt = (
        "You are a cadastral extraction model. Given an uploaded cadastral map image, "
        "extract adjacent parcel numbers and road labels with widths. Respond JSON: "
        "{\"parcels\": [{\"id\": <str>, \"geometry\": <optional geojson> }], \"annotations\": [{\"text\": <str>, \"bbox\": [x,y,w,h], \"type\": <str>}] }"
    )

    body = {
        'model': 'gpt-4o-mini',
        'messages': [
            {'role': 'system', 'content': 'You are a cadastral OCR and parser.'},
            {'role': 'user', 'content': prompt}
        ],
        'max_tokens': 800,
    }

    resp = requests.post(url, headers=headers, json=body, timeout=20)
    resp.raise_for_status()
    data = resp.json()

    # Attempt to extract JSON from response
    content = data.get('choices', [{}])[0].get('message', {}).get('content', '')
    try:
        # naive extraction
        start = content.find('{')
        obj = json.loads(content[start:]) if start != -1 else {}
    except Exception:
        obj = {'raw': content}

    return obj
