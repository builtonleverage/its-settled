# Drives the real UI on a phone-sized viewport against `wrangler dev` and saves screenshots.
#   python3 test/ui.py <out_dir>        (BASE env var, default http://localhost:8787)
import os, sys, re
from playwright.sync_api import sync_playwright

B = os.environ.get('BASE', 'http://localhost:8787')
OUT = sys.argv[1]
CSV = os.path.join(os.path.dirname(__file__), 'fixtures', 'tricount-sample.csv')
errors = []
def shot(p, name): p.screenshot(path=os.path.join(OUT, name + '.png'))
def phone(br, **kw):
    ctx = br.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, service_workers='block', **kw)
    p = ctx.new_page(); p.on('pageerror', lambda e: errors.append(str(e))); return ctx, p
def confirm(p): p.click('.ask [data-r="1"]')

with sync_playwright() as pw:
    br = pw.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx, p = phone(br)
    p.goto(B + '/'); p.wait_for_selector('.logo'); shot(p, '01-landing')
    p.click('text=Start a flat'); p.fill('#n-flat', 'Flat 7B'); p.fill('#n-name', 'Asha'); p.click('text=Create flat'); p.wait_for_selector('.hero')

    # import history
    p.click('.nav >> text=Flat'); p.click('text=Import CSV'); p.set_input_files('input[type=file]', CSV)
    p.wait_for_selector('text=Import 42 entries'); p.wait_for_timeout(300); shot(p, '02-import')
    p.click('[data-a=imp-go]'); p.wait_for_selector('text=Settle up'); p.wait_for_timeout(300); shot(p, '03-home')
    simplified = p.locator('.sec:has-text("Settle up") + .card .row').count()

    # simplify switch off → direct debts
    p.click('.nav >> text=Flat'); p.locator('#simplify').scroll_into_view_if_needed(); p.wait_for_timeout(200); shot(p, '04-settings')
    p.click('#simplify'); p.wait_for_timeout(600); p.click('.nav >> text=Home'); p.wait_for_selector('text=direct debts')
    direct = p.locator('.sec:has-text("Settle up") + .card .row').count()
    print('settle rows simplified/direct:', simplified, direct)
    p.click('.nav >> text=Flat'); p.click('#simplify'); p.wait_for_timeout(600)

    # add a guest → link sheet
    p.click('[data-a=guest-new]'); p.fill('#g-name', 'Neha'); shot(p, '05-add-guest')
    p.click('form[data-f=guest] >> text=Add guest'); p.wait_for_selector('text=Neha is added'); p.wait_for_timeout(300); shot(p, '06-guest-link')
    href = p.get_attribute('.sheet a.btn', 'href'); link = re.search(r'(https?://\S+#login=\w+)', __import__('urllib.parse').parse.unquote(href)).group(1)
    p.click('text=Done')

    # resident adds dinner with the guest (guest chip is off by default; tap it)
    p.click('.fab'); p.fill('#a-amt', '1800'); p.fill('#a-desc', 'Dinner')
    p.click('[data-group=split] .chip:has-text("Neha")'); shot(p, '07-add-with-guest')
    p.click('form[data-f=add] >> text=Save'); p.wait_for_timeout(800)

    # guest opens their link in their own browser
    gctx, g = phone(br, color_scheme='dark')
    g.goto(link.replace('http://localhost:8787', B)); g.wait_for_selector('.hero'); g.wait_for_timeout(300); shot(g, '08-guest-home')
    rows = g.locator('.row.tap').count(); print('guest sees entries:', rows)
    g.click('.fab'); g.wait_for_timeout(250); shot(g, '09-guest-add')
    g.fill('#a-amt', '300'); g.fill('#a-desc', 'Cab'); g.click('form[data-f=add] >> text=Save'); g.wait_for_timeout(800)
    print('guest entries after add:', g.locator('.row.tap').count())

    # offline queue still works
    ctx.set_offline(True); p.evaluate("window.dispatchEvent(new Event('offline'))")
    p.click('.nav >> text=Home'); p.click('.fab'); p.fill('#a-amt', '120'); p.click('[data-a=quick] >> nth=0'); p.click('form[data-f=add] >> text=Save')
    p.wait_for_selector('text=waiting to sync'); print('offline pill:', p.inner_text('.pill'))
    ctx.set_offline(False); p.evaluate("window.dispatchEvent(new Event('online'))"); p.wait_for_selector('text=Up to date', timeout=10000)
    print('back online:', p.inner_text('.pill'))

    # in-app confirm replaces confirm(): delete flow
    p.click('.nav >> text=Flat'); p.click('[data-a=guest] >> nth=0'); p.wait_for_timeout(200); shot(p, '10-guest-manage')

    d = phone(br)[1]; d.goto(B + '/demo'); d.wait_for_selector('.hero'); shot(d, '11-demo')
    d.click('.nav >> text=Flat'); d.click('text=See what a guest sees'); d.wait_for_selector('text=you\'re seeing what guest'); shot(d, '12-demo-guest')
    print('JS errors:', errors or 'none')
    br.close()
