#!/usr/bin/env python3
"""
Test visivi automatici Cicla Qui — screenshot + misure sui principali
viewport iPhone e Android.

Per ogni dispositivo verifica:
  1. /auth        — il bottone Accedi/Registrati è visibile e non coperto
  2. /            — la CTA principale è visibile
  3. /app/bici    — (solo con sessione) modale "Nuova bici": il bottone
                    "Registra bici" resta sopra navbar/toolbar iOS

Uso:
  python3 scripts/visual-checks/shoot.py [base_url]
  # default base_url: http://localhost:8080

Gli screenshot finiscono in /tmp/browser/visual-checks/<device>/.
Exit code 0 = tutti i check passati, 1 = almeno un fallimento.
"""
import asyncio
import json
import os
import sys
from pathlib import Path

from playwright.async_api import async_playwright

BASE_URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080"
OUT = Path("/tmp/browser/visual-checks")

# Viewport reali (CSS px). dpr non influenza le misure ma rende gli shot fedeli.
DEVICES = {
    "iphone-se": dict(width=375, height=667, device_scale_factor=2,
                      is_mobile=True, has_touch=True,
                      user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"),
    "iphone-15-pro-max": dict(width=430, height=932, device_scale_factor=3,
                              is_mobile=True, has_touch=True,
                              user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"),
    "pixel-7": dict(width=412, height=915, device_scale_factor=2.625,
                    is_mobile=True, has_touch=True,
                    user_agent="Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36"),
    "galaxy-s23": dict(width=360, height=780, device_scale_factor=3,
                       is_mobile=True, has_touch=True,
                       user_agent="Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36"),
}

results = []


def report(device, check, ok, detail):
    results.append((device, check, ok, detail))
    print(f"[{'PASS' if ok else 'FAIL'}] {device} · {check}: {detail}")


async def measure_button(page, device, check, label):
    """Il bottone deve essere nel viewport e staccato dal bordo inferiore."""
    btn = page.get_by_role("button", name=label).last
    if not await btn.count() or not await btn.is_visible():
        report(device, check, False, f"bottone '{label}' non trovato/visibile")
        return None
    box = await btn.bounding_box()
    vh = await page.evaluate("window.innerHeight")
    bottom_gap = vh - (box["y"] + box["height"])
    fully_visible = box["y"] >= 0 and (box["y"] + box["height"]) <= vh
    ok = fully_visible and bottom_gap >= 8
    report(device, check, ok,
           f"'{label}' bottom={box['y'] + box['height']:.0f}px viewport={vh}px distanza dal fondo={bottom_gap:.0f}px")
    return box


async def restore_session(page, context):
    """Ripristina la sessione gestita se disponibile (vedi LOVABLE_BROWSER_AUTH_STATUS)."""
    if os.environ.get("LOVABLE_BROWSER_AUTH_STATUS") != "injected":
        return False
    storage_key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
    session_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
    if not (storage_key and session_json):
        return False
    await page.goto(BASE_URL, wait_until="domcontentloaded")
    await page.evaluate(
        f"window.localStorage.setItem({json.dumps(storage_key)}, {json.dumps(session_json)})"
    )
    return True


async def check_device(pw, name, cfg):
    device_dir = OUT / name
    device_dir.mkdir(parents=True, exist_ok=True)
    browser = await pw.chromium.launch(headless=True)
    context = await browser.new_context(
        viewport={"width": cfg["width"], "height": cfg["height"]},
        device_scale_factor=cfg["device_scale_factor"],
        is_mobile=cfg["is_mobile"],
        has_touch=cfg["has_touch"],
        user_agent=cfg["user_agent"],
    )
    page = await context.new_page()
    authed = await restore_session(page, context)

    # 1) Landing: CTA visibile
    await page.goto(BASE_URL + "/", wait_until="networkidle")
    await page.screenshot(path=str(device_dir / "1_home.png"))
    cta = page.get_by_role("link", name="Inizia ora").first
    if await cta.count():
        box = await cta.bounding_box()
        vh = await page.evaluate("window.innerHeight")
        ok = box is not None and 0 <= box["y"] and box["y"] + box["height"] <= vh
        report(name, "home CTA", ok,
               f"CTA y={box['y']:.0f} h={box['height']:.0f} viewport={vh}" if box else "no box")
    else:
        report(name, "home CTA", False, "CTA 'Inizia ora' non trovata")

    # 2) Auth: bottone submit raggiungibile (scroll se serve)
    await page.goto(BASE_URL + "/auth", wait_until="networkidle")
    submit = page.get_by_role("button", name="Accedi").first
    if await submit.count():
        await submit.scroll_into_view_if_needed()
    await page.screenshot(path=str(device_dir / "2_auth.png"))
    await measure_button(page, name, "auth submit", "Accedi")

    # 3) Passaporto bici: modale + bottone sopra la navbar
    if authed:
        await page.goto(BASE_URL + "/app/bici", wait_until="networkidle")
        await page.screenshot(path=str(device_dir / "3_bici.png"))
        add = page.get_by_role("button", name="Aggiungi").first
        if await add.count():
            await add.click()
            await page.wait_for_timeout(400)  # transizione sheet
            await page.screenshot(path=str(device_dir / "4_bici_modal.png"))
            await measure_button(page, name, "bici modal submit", "Registra bici")
        else:
            report(name, "bici modal", False, "bottone 'Aggiungi' non trovato")
    else:
        report(name, "bici modal", True, "saltato (nessuna sessione)")

    await browser.close()


async def main():
    async with async_playwright() as pw:
        for name, cfg in DEVICES.items():
            try:
                await check_device(pw, name, cfg)
            except Exception as e:
                report(name, "errore", False, str(e)[:200])

    failed = [r for r in results if not r[2]]
    print(f"\n== {len(results) - len(failed)}/{len(results)} check passati ==")
    sys.exit(1 if failed else 0)


asyncio.run(main())
