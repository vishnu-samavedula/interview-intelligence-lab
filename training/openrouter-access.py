"""Credential-safe OpenRouter CLI preflight. Prints status/model metadata, never the key."""
import json
import urllib.request
import urllib.error
from pathlib import Path

def load_key():
    for line in Path('.env').read_text().splitlines():
        name, separator, value = line.strip().partition('=')
        if separator and name == 'OPENROUTER_API_KEY':
            key = value.strip().strip('\"\x27')
            if key: return key
    raise RuntimeError('OPENROUTER_API_KEY is missing or empty')

def main():
    try:
        request = urllib.request.Request('https://openrouter.ai/api/v1/key', headers={'Authorization': 'Bearer ' + load_key()})
        with urllib.request.urlopen(request, timeout=20) as response:
            data = json.load(response)['data']
        print(json.dumps({'authenticated': True, 'is_free_tier': data.get('is_free_tier')}))
        with urllib.request.urlopen('https://openrouter.ai/api/v1/models', timeout=30) as response:
            models = {item['id']: item for item in json.load(response)['data']}
        for name in ['anthropic/claude-haiku-4.5', 'google/gemini-3.5-flash-lite']:
            item = models.get(name)
            print(json.dumps({'model': name, 'available': item is not None, 'supported_parameters': item.get('supported_parameters', []) if item else []}))
    except urllib.error.HTTPError as error:
        raise SystemExit('OpenRouter preflight returned HTTP ' + str(error.code))
    except urllib.error.URLError:
        raise SystemExit('OpenRouter preflight could not reach the service')

if __name__ == '__main__': main()
