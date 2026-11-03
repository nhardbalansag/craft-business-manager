"""Independent native SQLite checks matching CraftBackupFiles.kt at mobile commit
209ec7298921b42aa89c72dd6f5eab0133317e81. Never opens a user's live database.
Usage: python scripts/verify-mobile-sqlite.py test-results/portable.sqlite
"""
import hashlib
import json
import sqlite3
import sys
from pathlib import Path


def sha(value):
    return hashlib.sha256(value.encode('utf-8') if isinstance(value, str) else value).hexdigest()


def verify(path):
    db = sqlite3.connect(Path(path).resolve().as_uri() + '?mode=ro', uri=True)
    assert db.execute('PRAGMA application_id').fetchone()[0] == 0x4D4C4346
    assert db.execute('PRAGMA user_version').fetchone()[0] == 1
    assert db.execute('PRAGMA quick_check(1)').fetchone()[0] == 'ok'
    meta = dict(db.execute('SELECT key,value FROM craft_meta LIMIT 20'))
    assert meta['format'] == 'my-lovely-craft-backup' and meta['version'] == '1'
    chunks = list(db.execute('SELECT position,content FROM craft_state_chunks ORDER BY position LIMIT 1500'))
    assert [row[0] for row in chunks] == list(range(len(chunks)))
    text = ''.join(row[1] for row in chunks)
    assert all(len(row[1].encode('utf-16-le')) // 2 <= 24000 for row in chunks)
    assert len(text.encode()) <= 32 * 1024 * 1024 and sha(text) == meta['state_sha256']
    state = json.loads(text)
    shape = meta['dataset_shape']
    assert sha(shape) == meta['dataset_shape_sha256']
    data = json.loads(shape)
    digest = ''
    size = len(text.encode())
    for collection, position, record, expected in db.execute('SELECT collection,position,json,sha256 FROM craft_records ORDER BY collection,position LIMIT 500001'):
        assert data is not None and collection in data and isinstance(data[collection], list)
        assert position == len(data[collection]) and sha(record) == expected
        assert len(record.encode('utf-16-le')) // 2 <= 1024 * 1024
        size += len(record.encode())
        assert size <= 32 * 1024 * 1024
        data[collection].append(json.loads(record))
        digest += f'{collection}:{position}:{expected}\n'
    assert sha(digest) == meta['records_sha256']
    images = {}
    for image_id, mime, value in db.execute('SELECT sha256,mime_type,bytes FROM craft_images LIMIT 10001'):
        assert mime == 'image/jpeg' and 0 < len(value) <= 360000 and sha(value) == image_id
        assert value[:3] == b'\xff\xd8\xff'
        images[image_id] = value
    assert len(images) <= 10000 and len(images) == int(meta['image_count'])
    assert sha('\n'.join(sorted(images))) == meta['image_ids_sha256']
    keys = {'uri', 'thumbnailUri', 'sourceImageUri', 'sourceBrochureUri'}

    def visit(value):
        if isinstance(value, list):
            for child in value:
                visit(child)
        elif isinstance(value, dict):
            for key, child in value.items():
                if key in keys and isinstance(child, str):
                    assert child.startswith('backup://image/') and child[15:] in images
                else:
                    visit(child)

    visit(state)
    assert state['version'] == 1 and isinstance(state['requests'], list) and isinstance(state['jobs'], list)
    assert isinstance(state['sourceUrl'], str) and state['printer']['columns'] in [32, 42, 48]
    if data is not None:
        assert state['snapshot'] is not None and data['schemaVersion'] == 5
    print(json.dumps({'native_sqlite': 'passed', 'products': len(data['products']) if data else 0,
                      'images': len(images), 'receipts': len(state.get('customerReceipts', []))}))
    db.close()


if __name__ == '__main__':
    verify(sys.argv[1])
