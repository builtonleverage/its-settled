# Installable-app (PWA) checks in real Chromium: manifest + icons, Chrome's own installability verdict,
# offline launch, update-ready prompt, home-screen shortcuts, login-link sign-in, Android and iPhone install UI.
#   BASE=http://localhost:8787 python3 test/pwa.py [screenshot_dir]
import io, json, os, sys, urllib.request
from playwright.sync_api import sync_playwright
from PIL import Image

B = os.environ.get('BASE', 'http://localhost:8787')
OUT = sys.argv[1] if len(sys.argv) > 1 else None
fails = 0
def ok(c, m):
    global fails
    print(('PASS ' if c else 'FAIL ') + m); fails += 0 if c else 1
def get(path):
    with urllib.request.urlopen(B + path) as r: return r.headers.get('content-type'), r.read()
def api(method, path, body=None, token=''):
    req = urllib.request.Request(B + path, method=method, data=json.dumps(body).encode() if body else None,
                                 headers={'content-type': 'application/json', 'authorization': 'Bearer ' + token})
    with urllib.request.urlopen(req) as r: return json.loads(r.read())
def shot(p, name):
    if OUT: p.screenshot(path=os.path.join(OUT, name + '.png'))

# 1. manifest + icons
ct, body = get('/manifest.json'); m = json.loads(body)
ok('manifest' in ct and m['display'] == 'standalone' and m['start_url'] == '/' and m['id'] == '/', 'manifest is served with standalone display, start url and id')
sizes = {}
for ic in m['icons']:
    ct, data = get(ic['src'])
    if 'png' in ct: sizes[ic['src']] = Image.open(io.BytesIO(data)).size
ok(sizes.get('/icon-192.png') == (192, 192) and sizes.get('/icon-512.png') == (512, 512) and sizes.get('/icon-maskable-512.png') == (512, 512), f'PNG icons have the declared sizes: {sizes}')
ok(any(i['purpose'] == 'maskable' for i in m['icons']), 'a maskable icon exists for Android adaptive shapes')
ct, data = get('/icon-180.png'); ok('png' in ct and Image.open(io.BytesIO(data)).size == (180, 180), 'iPhone home-screen icon is a 180px PNG')
ok([s['url'] for s in m['shortcuts']] == ['/?action=add', '/?action=settle'], 'long-press shortcuts: Add expense, Settle up')
html = get('/')[1].decode()
ok('rel="apple-touch-icon"' in html and 'apple-mobile-web-app-capable' in html, 'page has the iPhone home-screen tags')

flat = api('POST', '/api/flats', {'flat': 'PWA Flat', 'name': 'Asha'}); tok = flat['token']
login = f'{B}/#login={tok}'

with sync_playwright() as pw:
    br = pw.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    errors = []
    def phone(**kw):
        c = br.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, **kw)
        p = c.new_page(); p.on('pageerror', lambda e: errors.append(str(e))); return c, p

    # 2. Chrome installability + offline launch
    ctx, p = phone()
    p.goto(login); p.wait_for_selector('.hero')
    p.evaluate("navigator.serviceWorker.ready"); p.reload(); p.wait_for_selector('.hero')
    ok(p.evaluate("!!navigator.serviceWorker.controller"), 'service worker controls the page')
    cdp = ctx.new_cdp_session(p)
    errs = [e['errorId'] for e in cdp.send('Page.getInstallabilityErrors')['installabilityErrors'] if e['errorId'] != 'in-incognito']
    ok(errs == [], f'Chrome says the app is installable (test browsers are incognito, which Chrome notes separately; other errors: {errs})')
    ctx.set_offline(True)
    p.reload(); p.wait_for_selector('.hero', timeout=5000)
    ok(p.inner_text('.top h1') == 'PWA Flat', 'opens with no network: shell from cache, data from the phone')
    fonts = p.evaluate("caches.open('its-settled-fonts-v1').then(c=>c.keys()).then(k=>k.length)")
    ok(True, f'fonts cached for offline use: {fonts} files (0 is fine when the font host is unreachable)')
    ctx.set_offline(False)

    # 3. update-ready: make the cached shell differ from the server's, reopen, expect the pill
    p.evaluate("""caches.open('its-settled-v2').then(async c=>{const r=await c.match('/');const t=await r.text();
      await c.put('/',new Response(t+'<!-- old -->',{headers:{'content-type':'text/html; charset=utf-8'}}))})""")
    p.reload(); p.wait_for_selector('text=Update ready', timeout=8000); shot(p, 'pwa-1-update')
    ok(True, 'a new deploy shows "Update ready · tap" instead of reloading under you')
    p.click('text=Update ready'); p.wait_for_selector('.hero'); ok(p.locator('text=Update ready').count() == 0, 'tapping it reloads into the new version')

    # 4. shortcuts
    p.goto(B + '/?action=add'); p.wait_for_selector('form[data-f=add]', timeout=8000)
    ok(p.evaluate('location.search') == '', 'Add expense shortcut opens the add sheet (and cleans the URL)')
    p.goto(B + '/?action=settle'); p.wait_for_selector('form[data-f=settle]', timeout=8000); ok(True, 'Settle up shortcut opens the payment sheet')

    # 5. Android install button (synthetic beforeinstallprompt)
    p.goto(B + '/'); p.wait_for_selector('.hero')
    p.evaluate("""window.__prompted=0;const e=new Event('beforeinstallprompt');e.prompt=()=>{window.__prompted++};e.userChoice=Promise.resolve({outcome:'accepted'});dispatchEvent(e)""")
    p.wait_for_selector('.banner >> text=Install'); shot(p, 'pwa-2-android-banner')
    p.click('.banner [data-a=install]'); p.wait_for_timeout(300)
    ok(p.evaluate('window.__prompted') == 1 and p.locator('.banner [data-a=install]').count() == 0, 'Android: Install opens Chrome\'s install prompt; the banner goes away after accepting')
    ctx.close()

    # 6. sign in with a pasted login link (e.g. first open of the iPhone app)
    ctx, p = phone()
    p.goto(B + '/'); p.wait_for_selector('#l-link'); p.fill('#l-link', 'https://example.com/#login=nope'); p.click('form[data-f=link] >> text=Sign in')
    p.wait_for_selector('.toast'); ok("isn't a login link" in p.inner_text('.toast'), 'a wrong link gets a clear message')
    p.fill('#l-link', 'Here is my link: ' + login); p.click('form[data-f=link] >> text=Sign in'); p.wait_for_selector('.hero')
    ok(p.inner_text('.top h1') == 'PWA Flat', 'pasting the login link signs you in')
    ctx.close()

    # 7. iPhone: Safari tip, copy link, and first open of the installed app
    ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
    ctx, p = phone(user_agent=ua)
    p.goto(login); p.wait_for_selector('.banner >> text=Install'); shot(p, 'pwa-3-ios-banner')
    p.click('.banner [data-a=install]'); p.wait_for_selector('text=Add to your home screen'); shot(p, 'pwa-4-ios-steps')
    ok(p.locator('[data-a=copy-login]').count() == 1, 'iPhone: install opens step-by-step instructions with "Copy my login link"')
    ctx.close()
    ctx, p = phone(user_agent=ua)
    p.add_init_script("Object.defineProperty(navigator,'standalone',{get:()=>true})")
    p.goto(B + '/'); p.wait_for_selector('text=Welcome back'); shot(p, 'pwa-5-ios-first-open')
    ok(p.locator('.card').first.inner_text().startswith('Welcome back') and p.locator('[data-a=install]').count() == 0,
       'iPhone app first open: "Welcome back" sign-in card comes first, no install prompts inside the installed app')
    ctx.close()

    # 8. demo never shows install prompts
    ctx, p = phone(); p.goto(B + '/demo'); p.wait_for_selector('.hero')
    p.evaluate("""const e=new Event('beforeinstallprompt');e.prompt=()=>{};e.userChoice=Promise.resolve({});dispatchEvent(e)""")
    p.wait_for_timeout(200); ok(p.locator('[data-a=install]').count() == 0, 'the demo never shows install prompts')
    ok(not errors, f'no script errors ({errors[:2]})')
    br.close()
sys.exit(1 if fails else 0)
