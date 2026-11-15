# Regression: typed text in a bottom sheet must survive background re-renders and stray taps outside.
# Runs against the in-browser demo, so it needs no database.
#   BASE=http://localhost:8787 python3 test/sheet.py
import os
from playwright.sync_api import sync_playwright

B = os.environ.get('BASE', 'http://localhost:8787')
fails = 0
def ok(c, m):
    global fails
    print(('PASS ' if c else 'FAIL ') + m); fails += 0 if c else 1

with sync_playwright() as pw:
    br = pw.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = br.new_context(viewport={'width': 390, 'height': 844}, service_workers='block')
    p = ctx.new_page(); errors = []; p.on('pageerror', lambda e: errors.append(str(e)))
    p.goto(B + '/demo'); p.wait_for_selector('.hero')
    p.click('.fab'); p.wait_for_selector('#a-amt')
    p.fill('#a-amt', '450'); p.fill('#a-desc', 'Groceries')
    p.click('[data-group=paid] .chip >> nth=1'); p.click('[data-group=split] .chip >> nth=0')
    paid = p.eval_on_selector('[data-group=paid] .chip.on', 'e => e.dataset.id')
    split = p.eval_on_selector_all('[data-group=split] .chip.on', 'es => es.map(e => e.dataset.id).sort().join()')

    # 1. a background sync (30s tick, tab focus, back online) must not touch the open form
    p.focus('#a-desc')
    p.evaluate('refresh()'); p.wait_for_timeout(400)
    ok(p.input_value('#a-amt') == '450' and p.input_value('#a-desc') == 'Groceries', 'sync keeps typed amount and description')
    ok(p.eval_on_selector('[data-group=paid] .chip.on', 'e => e.dataset.id') == paid, 'sync keeps the "paid by" pick')
    ok(p.eval_on_selector_all('[data-group=split] .chip.on', 'es => es.map(e => e.dataset.id).sort().join()') == split, 'sync keeps the split picks')
    ok(p.evaluate("document.activeElement.id") == 'a-desc', 'sync keeps focus (keyboard stays up)')

    # 2. when the sheet markup does change under the person, the rebuild carries their input over
    p.evaluate("D.members.push({id:'zz', name:'Zed', role:'member', status:'approved'}); render()"); p.wait_for_timeout(300)
    ok(p.locator('[data-group=paid] .chip', has_text='Zed').count() == 1, 'sheet picked up the new flatmate')
    ok(p.input_value('#a-amt') == '450' and p.input_value('#a-desc') == 'Groceries', 'rebuild keeps typed text')
    ok(p.eval_on_selector('[data-group=paid] .chip.on', 'e => e.dataset.id') == paid, 'rebuild keeps the "paid by" pick')

    # 3. a stray tap outside asks first; Cancel keeps everything
    p.mouse.click(195, 30); p.wait_for_selector('.ask')
    ok(p.locator('.sheet #a-amt').count() == 1, 'tap outside with typed text does not close the sheet')
    p.click('.ask [data-r="0"]'); p.wait_for_timeout(200)
    ok(p.input_value('#a-amt') == '450' and p.input_value('#a-desc') == 'Groceries', 'Cancel keeps the typed text')

    # 4. confirming discards
    p.mouse.click(195, 30); p.wait_for_selector('.ask'); p.click('.ask [data-r="1"]'); p.wait_for_timeout(300)
    ok(p.locator('.scrim').count() == 0, 'Discard closes the sheet')

    # 5. an untouched sheet still closes with one tap
    p.click('.fab'); p.wait_for_selector('#a-amt'); p.mouse.click(195, 30); p.wait_for_timeout(300)
    ok(p.locator('.scrim').count() == 0 and p.locator('.ask').count() == 0, 'empty sheet closes on a tap outside, no prompt')

    # 6. backdating: the date lands the entry on that day; today is the default; the future is refused
    p.click('.fab'); p.wait_for_selector('#a-date')
    ok(p.input_value('#a-date') == p.evaluate('ymd(Date.now())'), 'date defaults to today')
    p.fill('#a-amt', '300'); p.fill('#a-desc', 'Backdated cab')
    p.fill('#a-date', p.evaluate('ymd(Date.now() - 3 * 864e5)'))
    p.screenshot(path='/tmp/sheet-date.png')
    p.click('form[data-f=add] >> text=Save'); p.wait_for_timeout(600)
    want = p.evaluate('day(Date.now() - 3 * 864e5)')
    row = p.locator('.row', has_text='Backdated cab').first.inner_text()
    ok(want in row, f'entry shows on the picked day ({want}): {row!r}')
    p.click('.fab'); p.wait_for_selector('#a-date'); p.fill('#a-amt', '10'); p.fill('#a-desc', 'Future test')
    p.fill('#a-date', p.evaluate('ymd(Date.now() + 2 * 864e5)')); p.click('form[data-f=add] >> text=Save'); p.wait_for_timeout(400)
    ok(p.locator('#a-date').count() == 1 and p.locator('.row', has_text='Future test').count() == 0, 'a future date is refused and nothing is added')

    ok(not errors, f'no JS errors {errors}')
    br.close()
raise SystemExit(1 if fails else 0)
