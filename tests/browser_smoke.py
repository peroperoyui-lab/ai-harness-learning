"""Optional browser acceptance checks. No real API calls or credentials.
Run: python -m pip install playwright && python -m playwright install chromium
Then: python tests/browser_smoke.py
Use CHROMIUM_PATH to select an existing Chromium executable.
"""
import json
import os
import pathlib
import subprocess
import time
import urllib.request
from playwright.sync_api import sync_playwright, expect

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "test-results"
OUT.mkdir(exist_ok=True)
BASE = "http://127.0.0.1:4179"
server = subprocess.Popen(["node", "server/index.mjs", "--port=4179"], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
try:
    for _ in range(100):
        try:
            with urllib.request.urlopen(BASE + "/api/config", timeout=1) as response:
                if response.status == 200:
                    break
        except Exception:
            time.sleep(.1)
    else:
        raise RuntimeError("Local server did not become ready")
    catalog = json.loads(subprocess.check_output(["node", "--input-type=module", "-e", "import {lessons,labs} from './web/content/course.js'; console.log(JSON.stringify({lessons:lessons.map(l=>l.id),labs:Object.keys(labs)}));"], cwd=ROOT, text=True))
    with sync_playwright() as p:
        options = {"headless": True, "args": ["--no-sandbox"]}
        if os.getenv("CHROMIUM_PATH"):
            options["executable_path"] = os.environ["CHROMIUM_PATH"]
        browser = p.chromium.launch(**options)
        context = browser.new_context(viewport={"width": 1440, "height": 1000}, reduced_motion="reduce")
        page = context.new_page()
        errors = []
        external_requests = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("request", lambda req: external_requests.append(req.url) if not req.url.startswith(BASE) else None)
        def visit(route):
            page.goto(BASE + "/#" + route)
            page.wait_for_function("document.querySelector('#main h1') !== null")
            page.wait_for_timeout(60)
        def no_overflow():
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), page.url
        visit("/")
        expect(page.locator(".chapter-card")).to_have_count(6)
        no_overflow()
        page.screenshot(path=str(OUT / "overview-desktop.png"), full_page=True)
        routes = ["/", "/labs", "/history", "/glossary", "/sources"] + ["/learn/" + x for x in catalog["lessons"]] + ["/lab/" + x for x in catalog["labs"]]
        for route in routes:
            visit(route)
            assert "这条学习路径还不存在" not in page.locator("#main").inner_text(), route
            no_overflow()
            if route.startswith("/learn/"):
                expect(page.locator("[data-guide-step]")).to_have_count(3)
                expect(page.locator("#guide-position")).to_have_text("1 / 3")
                expect(page.locator("#guide-back")).to_be_disabled()
                page.locator("#guide-next").click()
                expect(page.locator("#guide-position")).to_have_text("2 / 3")
                page.locator('[data-guide-step="2"]').click()
                expect(page.locator("#guide-next")).to_be_disabled()
                page.locator("#guide-reveal").click()
                expect(page.locator("#guide-answer")).to_be_visible()
                expect(page.locator("#guide-reveal")).to_have_attribute("aria-expanded", "true")
                assert len(page.locator("#guide-answer").inner_text()) > 10
        visit("/learn/harness")
        page.locator('[data-answer="1"]').click()
        expect(page.locator("#quiz-feedback")).to_contain_text("答对了")
        page.locator("#complete-lesson").click()
        page.reload()
        expect(page.locator("#complete-lesson")).to_contain_text("已掌握")
        page.screenshot(path=str(OUT / "lesson-desktop.png"), full_page=True)
        visit("/lab/trace")
        for _ in range(12):
            button = page.locator('[data-action="step"]')
            if button.is_disabled():
                break
            button.click()
        expect(page.locator(".lab-frame")).to_contain_text("已完成")
        expect(page.locator(".trace-map")).to_contain_text("161")
        page.locator('[data-action="save"]').click()
        page.screenshot(path=str(OUT / "trace-desktop.png"), full_page=True)
        page.locator("#trace-scenario").select_option("approval")
        for _ in range(7):
            if page.locator('[data-action="step"]').is_disabled():
                break
            page.locator('[data-action="step"]').click()
        expect(page.locator('[data-action="approve"]')).to_be_visible()
        page.locator('[data-action="deny"]').click()
        expect(page.locator(".lab-frame")).to_contain_text("已拒绝")
        visit("/lab/schema")
        page.locator('[data-preset="1"]').click()
        expect(page.locator("#schema-result")).to_contain_text("合同失败")
        page.locator('[data-preset="0"]').click()
        expect(page.locator("#schema-result")).to_contain_text("161")
        visit("/lab/context")
        page.locator("#capacity").fill("400")
        page.locator("#reserve").fill("400")
        expect(page.locator("#context-result")).to_contain_text("无法装入")
        visit("/lab/retrieval")
        page.locator("#retrieval-query").fill("qzxwv")
        page.locator("#search-docs").click()
        expect(page.locator("#retrieval-results")).to_contain_text("没有词面重合")
        visit("/lab/stream")
        page.locator("#chunk-size").fill("24")
        for _ in range(12):
            if page.locator("#stream-next").is_disabled():
                break
            page.locator("#stream-next").click()
        expect(page.locator("#stream-output")).to_have_text("你好，Harness！")
        expect(page.locator("#event-count")).to_have_text("3")
        visit("/lab/workflow")
        page.locator("#workflow-mode").select_option("parallel")
        expect(page.locator("#workflow-output .metric-box").first).to_contain_text("7")
        visit("/lab/memory")
        page.locator("#memory-next").click()
        page.locator("#memory-next").click()
        page.locator("#memory-save").click()
        page.reload()
        page.locator("#memory-restore").click()
        expect(page.locator("#memory-state")).to_contain_text("2 / 5")
        visit("/lab/safety")
        expect(page.locator("#safety-output")).to_contain_text("拒绝执行")
        page.locator("#requested-action").select_option("calculate")
        expect(page.locator("#safety-output")).to_contain_text("161")
        visit("/lab/eval")
        page.locator("#run-evals").click()
        expect(page.locator("#eval-results")).to_contain_text("20%")
        page.locator("#eval-implementation").select_option("correct")
        page.locator("#run-evals").click()
        expect(page.locator("#eval-results")).to_contain_text("100%")
        visit("/glossary")
        page.locator("#glossary-search").fill("MCP")
        expect(page.locator(".glossary-item")).to_have_count(1)
        visit("/playground")
        expect(page.locator('[data-mode="live"]')).to_be_enabled()
        page.locator("#persist-chat").check()
        page.locator("#chat-send").click()
        expect(page.locator("#chat-messages")).to_contain_text("预设演示")
        captured = []
        fake_key = "browser-test-key-not-real"
        def mocked_api(route):
            captured.append(route.request.post_data_json)
            route.fulfill(status=200, content_type="application/json", body=json.dumps({"text": "mock result " + fake_key, "calls": [], "usage": {"input": 13, "output": 5, "cached": None}, "finish": "stop", "validation": None, "toolResult": None}))
        page.route("**/api/demo", mocked_api)
        page.locator('[data-mode="live"]').click()
        page.locator("#api-model").fill("test-model")
        page.locator("#api-key").fill(fake_key)
        page.locator("#api-consent").check()
        page.locator("#chat-send").click()
        expect(page.locator("#chat-messages")).to_contain_text("[REDACTED]")
        assert len(captured) == 1
        assert captured[0]["maxTokens"] == 128
        assert captured[0]["history"] == []
        state = page.evaluate("localStorage.getItem('harness-lab:v1')")
        assert fake_key not in state
        page.screenshot(path=str(OUT / "playground-desktop.png"), full_page=True)
        visit("/history")
        assert page.locator(".history-card").count() >= 3
        # Resume the actual persisted transcript: no credentials, auto-send or implicit context.
        page.locator("#history-search").fill("真实")
        expect(page.locator(".history-card")).to_have_count(1)
        before_resume = page.evaluate("JSON.parse(localStorage.getItem('harness-lab:v1')).sessions.length")
        page.locator("[data-resume]").click()
        expect(page.locator("#chat-messages")).to_contain_text("[REDACTED]")
        expect(page.locator("#api-key")).to_have_value("")
        expect(page.locator("#api-model")).to_have_value("")
        expect(page.locator("#carry-history")).not_to_be_checked()
        expect(page.locator("#api-consent")).not_to_be_checked()
        assert len(captured) == 1
        page.locator("#api-model").fill("test-model")
        page.locator("#api-key").fill(fake_key)
        page.locator("#carry-history").check()
        page.locator("#api-consent").check()
        page.locator("#persist-chat").check()
        page.locator("#chat-prompt").fill("继续解释上下文")
        page.locator("#chat-send").click()
        expect(page.locator("#chat-messages .chat-message")).to_have_count(4)
        assert len(captured) == 2
        assert [m["role"] for m in captured[1]["history"]] == ["user", "assistant"]
        assert all(len(m["content"]) <= 400 for m in captured[1]["history"])
        assert fake_key not in json.dumps(captured[1]["history"])
        assert page.evaluate("JSON.parse(localStorage.getItem('harness-lab:v1')).sessions.length") == before_resume
        page.reload()
        expect(page.locator("#chat-messages .chat-message")).to_have_count(4)
        expect(page.locator("#api-key")).to_have_value("")
        expect(page.locator("#carry-history")).not_to_be_checked()
        assert len(captured) == 2
        visit("/history")
        # Export, import collision as a copy, invalid-format error and search.
        with page.expect_download() as download_info:
            page.locator("#export-history").click()
        downloaded = json.loads(pathlib.Path(download_info.value.path()).read_text())
        assert downloaded["version"] == 1
        assert fake_key not in json.dumps(downloaded)
        count_before = page.locator(".history-card").count()
        one = {"version": 1, "completed": [], "sessions": [downloaded["sessions"][0]]}
        page.once("dialog", lambda dialog: dialog.accept())
        page.locator("#history-import").set_input_files({"name":"lesson.json", "mimeType":"application/json", "buffer":json.dumps(one).encode()})
        expect(page.locator("#history-notice")).to_contain_text("导入完成")
        expect(page.locator(".history-card")).to_have_count(count_before + 1)
        ids = page.evaluate("JSON.parse(localStorage.getItem('harness-lab:v1')).sessions.map(s=>s.id)")
        assert len(ids) == len(set(ids))
        page.locator("#history-import").set_input_files({"name":"invalid.json", "mimeType":"application/json", "buffer":b'{"version":99}'})
        expect(page.locator("#history-notice")).to_contain_text("不支持此文件格式")
        expect(page.locator(".history-card")).to_have_count(count_before + 1)
        assert len(captured) == 2
        visit("/playground")
        page.locator('[data-mode="live"]').click()
        expect(page.locator("#api-key")).to_have_value("")
        # UI safety: persisted content remains text, even when it resembles markup.
        page.evaluate("""() => { const s=JSON.parse(localStorage.getItem('harness-lab:v1')); s.sessions.unshift({id:'xss-test',title:'<img src=x onerror=alert(1)>',mode:'simulation',date:'2026-01-01',messages:[{role:'assistant',content:'<script>window.injected=true</script>'}]});localStorage.setItem('harness-lab:v1',JSON.stringify(s)); }""")
        page.reload()
        visit("/history")
        assert page.locator("#main img").count() == 0
        assert page.evaluate("window.injected === undefined")
        # Small-screen routes, no horizontal document overflow.
        page.set_viewport_size({"width": 390, "height": 844})
        for route in ["/", "/learn/tools", "/lab/trace", "/lab/schema", "/playground", "/history", "/glossary"]:
            visit(route)
            no_overflow()
        visit("/")
        page.screenshot(path=str(OUT / "overview-mobile.png"), full_page=True)
        page.locator("#menu-toggle").click()
        expect(page.locator("#sidebar")).to_have_class("sidebar open")
        page.keyboard.press("Escape")
        expect(page.locator("#sidebar")).not_to_have_class("sidebar open")
        assert not errors, errors
        assert not external_requests, external_requests
        (OUT / "browser-report.json").write_text(json.dumps({"status": "passed", "routes_checked": len(routes) + 1, "viewports": ["1440x1000", "390x844"], "walkthroughs_checked": len(catalog["lessons"]), "session_resume": "reload, explicit context, import/export and collision checked", "live_api": "mocked, no provider request", "page_errors": errors, "external_requests": external_requests}, ensure_ascii=False, indent=2), encoding="utf-8")
        browser.close()
        print(f"PASS: {len(routes)+1} routes; desktop/mobile; labs, persistence, XSS text rendering; mocked live UI; zero external requests.")
finally:
    server.terminate()
    try:
        server.wait(timeout=5)
    except subprocess.TimeoutExpired:
        server.kill()
        server.wait()
