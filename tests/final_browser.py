"""Focused UI regressions for the final consolidation; no provider calls."""
import json
import pathlib
import subprocess
import time
import urllib.request
from playwright.sync_api import sync_playwright, expect

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'test-results'
OUT.mkdir(exist_ok=True)
BASE = 'http://127.0.0.1:4180'
server = subprocess.Popen(['node', 'server/index.mjs', '--port=4180'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
try:
    for _ in range(100):
        try:
            urllib.request.urlopen(BASE + '/api/config', timeout=1).close()
            break
        except Exception:
            time.sleep(.1)
    else:
        raise RuntimeError('Local server did not start')
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1440, 'height': 1000}, reduced_motion='reduce')
        errors, unexpected = [], []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('request', lambda req: unexpected.append(req.url) if not req.url.startswith(BASE) or '/api/demo' in req.url else None)
        page.on('dialog', lambda dialog: dialog.accept())
        page.goto(BASE + '/#/playground')
        page.locator('#persist-chat').check()
        page.locator('#chat-send').click()
        expect(page.locator('#chat-messages .chat-message')).to_have_count(2)
        page.locator('[data-mode="simulation"]').click()
        expect(page.locator('#chat-messages .chat-message')).to_have_count(2)
        # Switching to a different mode still deliberately starts a new conversation.
        expect(page.locator('[data-mode="live"]')).to_be_enabled()
        page.locator('[data-mode="live"]').click()
        expect(page.locator('#chat-messages .chat-message')).to_have_count(0)
        page.locator('#api-model').fill('not-sent')
        page.locator('[data-mode="live"]').click()
        expect(page.locator('#api-model')).to_have_value('not-sent')
        # Browser policy can deny deletion while reads continue to work.
        page.goto(BASE + '/#/history')
        expect(page.locator('.history-card')).to_have_count(1)
        page.evaluate("() => { window.originalRemove = Storage.prototype.removeItem; Storage.prototype.removeItem = function(){throw new Error('policy fixture')}; }")
        page.locator('#clear-history').click()
        expect(page.locator('#toast')).to_contain_text('拒绝清除存储')
        expect(page.locator('.history-card')).to_have_count(0)
        assert page.evaluate("JSON.parse(localStorage.getItem('harness-lab:v1')).sessions.length") == 1
        page.evaluate('() => { Storage.prototype.removeItem = window.originalRemove; }')
        page.reload()
        expect(page.locator('.history-card')).to_have_count(1)
        page.locator('#clear-history').click()
        expect(page.locator('#toast')).to_have_text('本站学习数据已清除。')
        assert page.evaluate("localStorage.getItem('harness-lab:v1')") is None
        assert not errors, errors
        assert not unexpected, unexpected
        (OUT / 'final-report.json').write_text(json.dumps({'status': 'passed', 'active_mode_preserves_chat': True, 'blocked_deletion_reports_failure': True, 'page_errors': errors, 'provider_requests': 0}, ensure_ascii=False, indent=2), encoding='utf-8')
        browser.close()
        print('PASS: active-mode clicks preserve chat; blocked deletion remains visible; no provider requests.')
finally:
    server.terminate()
    try:
        server.wait(timeout=5)
    except subprocess.TimeoutExpired:
        server.kill()
        server.wait()
