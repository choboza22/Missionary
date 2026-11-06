#!/usr/bin/env python3
"""인쇄용 QR 페이지 생성: python3 tools/gen_qr.py https://choboza22.github.io/Missionary/ """
import sys, io, segno, re
base = (sys.argv[1] if len(sys.argv) > 1 else 'https://choboza22.github.io/Missionary/').rstrip('/') + '/'
sys.path.insert(0, '.')
src = open('js/data.js', encoding='utf-8').read()
words = re.findall(r"(\w\d): \{ t: '([^']+)', ok: (true|false) \}", src)
stories = re.findall(r"(s\d): \{ n: (\d), mark: '(.)'", src)
def svg(code, url=None):
    b = io.BytesIO(); segno.make(url or f'{base}#/qr/{code}', error='m').save(b, kind='svg', scale=6, border=2, xmldecl=False, svgns=True); return b.getvalue().decode()
cards = []
for c, t, ok in words:
    cards.append(('100주년 QR', c, t))
for c, n, m in stories:
    cards.append(('본당 · 이야기 카드', c, m + ' 카드'))
html = ['<!doctype html><meta charset="utf-8"><title>QR 인쇄용</title><style>body{font-family:sans-serif}.g{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}.c{border:1px dashed #999;padding:12px;text-align:center;break-inside:avoid}.c svg{width:220px;height:220px}.k{font-size:12px;color:#666}.code{font-size:20px;font-weight:700}</style>',
        f'<h2>쉼을 찾아서 — QR 인쇄용</h2><p>주소: {base} · 인쇄 후 각 장소에 부착. QR 아래 코드는 직접 입력용. 이 안내문 자체(각 QR의 내용은 앱에서 확인.</p><div class="g">']
for place, c, label in cards:
    html.append(f'<div class="c"><div class="k">{place}</div>{svg(c)}<div class="code">{c}</div></div>')
html.append('</div>')
open('print-qr.html', 'w', encoding='utf-8').write('\n'.join(html))
# 앱 접속용 QR (참가자 시작용)
open('print-qr-start.html', 'w', encoding='utf-8').write(f'<!doctype html><meta charset="utf-8"><title>시작 QR</title><div style="text-align:center;font-family:sans-serif"><h1>쉼을 찾아서</h1><div style="width:360px;margin:auto">{svg("", base)}</div><p>{base}</p></div>')
print('ok', len(cards), 'QR →', base)
