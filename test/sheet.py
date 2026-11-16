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
    p.mouse.click(195, 30); p.wait_for_selector('.ask:not(.out)')
    ok(p.locator('.sheet #a-amt').count() == 1, 'tap outside with typed text does not close the sheet')
    p.click('.ask:not(.out) [data-r="0"]'); p.wait_for_timeout(200)
    ok(p.input_value('#a-amt') == '450' and p.input_value('#a-desc') == 'Groceries', 'Cancel keeps the typed text')

    # 4. confirming discards
    p.mouse.click(195, 30); p.wait_for_selector('.ask:not(.out)'); p.click('.ask:not(.out) [data-r="1"]'); p.wait_for_timeout(300)
    p.wait_for_timeout(150); ok(p.locator('.scrim').count() == 0, 'Discard closes the sheet')

    # 5. an untouched sheet still closes with one tap
    p.click('.fab'); p.wait_for_selector('#a-amt'); p.mouse.click(195, 30); p.wait_for_timeout(300)
    p.wait_for_timeout(150); ok(p.locator('.scrim').count() == 0 and p.locator('.ask').count() == 0, 'empty sheet closes on a tap outside, no prompt')

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

    p.evaluate('close()'); p.wait_for_timeout(350)  # leave the refused future-date sheet
    # 7. Add sheet shows each share and the total on Save; a swipe down closes an empty sheet
    p.click('.fab'); p.wait_for_selector('#a-amt'); p.wait_for_timeout(450); p.fill('#a-amt', '900')
    note = p.inner_text('.split-note'); btn = p.inner_text('[data-save]')
    ok('each' in note and '900' in btn, f'live share preview: {note!r} / {btn!r}')
    p.fill('#a-amt', ''); p.fill('#a-desc', '')
    p.evaluate("""() => { const sh = document.querySelector('.scrim .sheet'), r = sh.getBoundingClientRect(), x = r.left + 100;
      const T = y => new Touch({ identifier: 1, target: sh, clientX: x, clientY: y });
      sh.dispatchEvent(new TouchEvent('touchstart', { touches: [T(r.top + 30)], bubbles: true }));
      for (let i = 1; i <= 8; i++) sh.dispatchEvent(new TouchEvent('touchmove', { touches: [T(r.top + 30 + i * 40)], bubbles: true, cancelable: true }));
      sh.dispatchEvent(new TouchEvent('touchend', { touches: [], bubbles: true })); }""")
    p.wait_for_timeout(450)
    ok(p.locator('.scrim').count() == 0, 'swiping the sheet down closes it')

    # 8. Appearance: presets, custom colour and mode apply at once, survive a reload, and stay readable
    p.click('.nav >> text=Flat'); p.click('[data-a=appearance]'); p.wait_for_selector('.swatches')
    acc = lambda: p.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()")
    default = acc(); p.click('.sw[data-k=ocean]'); p.wait_for_timeout(150)
    ok(acc() != default and p.locator('.sw[data-k=ocean].on').count() == 1, f'Ocean applies at once ({default} -> {acc()})')
    p.click('.seg [data-m=dark]'); p.wait_for_timeout(150)
    ok(p.evaluate('document.documentElement.dataset.theme') == 'dark' and acc() != default, 'Dark mode applies and keeps the colour')
    p.evaluate("""() => { const i = document.getElementById('t-custom'); i.value = '#ffe600'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); }""")
    p.wait_for_timeout(150)
    ratio = p.evaluate("""() => { const g = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
      const rgb = h => [1,3,5].map(i => parseInt(h.slice(i, i + 2), 16)); return contrast(rgb(g('--accent')), rgb(g('--accent-ink'))); }""")
    ok(ratio >= 4.5 and p.locator('.sw.custom.on').count() == 1, f'a custom yellow is tuned to stay readable (contrast {ratio:.1f})')
    p.click('.seg [data-m=light]'); p.wait_for_timeout(100)
    ratio = p.evaluate("""() => { const g = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
      const rgb = h => [1,3,5].map(i => parseInt(h.slice(i, i + 2), 16)); return contrast(rgb(g('--accent')), rgb(g('--accent-ink'))); }""")
    ok(ratio >= 4.5, f'the same yellow in light mode stays readable (contrast {ratio:.1f})')
    # the colour input must survive picking and background syncs, or the phone's picker closes mid-drag
    same = p.evaluate("""() => { const i = document.getElementById('t-custom');
      for (const v of ['#ff0000', '#00ff00', '#0000ff']) { i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); render(); }
      return i.isConnected && document.getElementById('t-custom') === i && document.querySelector('.sw.custom.on') !== null; }""")
    ok(same, 'colour input is never rebuilt while picking or on a background sync')
    p.evaluate("""() => { const i = document.getElementById('t-custom'); i.value = '#ffe600'; i.dispatchEvent(new Event('input', { bubbles: true })); }""")
    p.reload(); p.wait_for_selector('.hero')
    ok(p.evaluate("ls.get('is_accent')") == '#ffe600' and p.evaluate('document.documentElement.dataset.theme') == 'light', 'the choice survives a reload')
    p.evaluate("ls.set('is_accent', null); ls.set('is_theme', null); applyTheme()")
    ok(acc() == default and 'theme' not in p.evaluate('Object.keys(document.documentElement.dataset)'), 'Forest + Auto restores the defaults')

    ok(not errors, f'no JS errors {errors}')
    br.close()
raise SystemExit(1 if fails else 0)
