#!/usr/bin/env python3
"""인쇄용 QR 페이지 생성: python3 tools/gen_qr.py [주소]
출력: print-qr.html(참가자용 부착물), print-qr-staff.html(스태프 정답표). PDF는 tools/make_pdf.js 로 변환."""
import sys, io, re, segno
base = (sys.argv[1] if len(sys.argv) > 1 else 'https://choboza22.github.io/Missionary/').rstrip('/') + '/'
src = open('js/data.js', encoding='utf-8').read()
cfg = open('js/config.js', encoding='utf-8').read()
words = re.findall(r"(h\d): \{ t: '([^']+)', ok: (true|false) \}", src)
stories = sorted(re.findall(r"(q\d): \{ n: (\d), mark: '(.)', t: '([^']+)'", src), key=lambda x: x[0])
rooms = dict(re.findall(r"(\w+): '신학관 (\d+호)'", cfg))

def svg(url):
    b = io.BytesIO(); segno.make(url, error='m').save(b, kind='svg', scale=6, border=2, xmldecl=False, svgns=True); t = b.getvalue().decode()
    m = re.search(r'width="(\d+)" height="(\d+)"', t)
    if m: t = t.replace(m.group(0), f'viewBox="0 0 {m.group(1)} {m.group(2)}"', 1)
    return t
def qr(code): return svg(f'{base}#/qr/{code}')

CSS = '''@page{size:A4;margin:12mm}body{font-family:"Noto Sans CJK KR","Noto Sans KR","Malgun Gothic",sans-serif;margin:0;color:#222}
.pg{page-break-after:always;min-height:270mm}h1{font-size:30pt;margin:0 0 4mm}h2{font-size:20pt;margin:0 0 4mm}.sub{color:#555;font-size:12pt;margin-bottom:8mm}
.g{display:grid;gap:6mm}.g2{grid-template-columns:repeat(2,1fr)}.g3{grid-template-columns:repeat(3,1fr)}
.c{border:1.5px dashed #888;text-align:center;padding:4mm;break-inside:avoid}.c svg{width:100%;max-width:50mm;height:auto}
.code{font-size:16pt;font-weight:700;letter-spacing:1px}.k{font-size:10pt;color:#666}
.big svg{width:130mm;height:auto}.room{border:3px solid #3f6b4f;border-radius:6mm;padding:10mm;margin-bottom:10mm;text-align:center}.room b{font-size:48pt;display:block}.room span{font-size:26pt}
table{border-collapse:collapse;width:100%;font-size:13pt}td,th{border:1px solid #999;padding:6px 8px;text-align:left}th{background:#eee}.ban{background:#c0504d;color:#fff;padding:3mm;font-weight:700;margin-bottom:5mm}'''

def page(inner): return f'<div class="pg">{inner}</div>'
P = []
P.append(page(f'<div class="big" style="text-align:center"><h1>🌿 쉼을 찾아서</h1><div class="sub">QR을 스캔해 시작하세요 · 조원과 함께</div>{svg(base)}<p class="code" style="margin-top:6mm">{base}</p></div>'))
P.append(page('<h2>신학관 방 안내 (문 앞에 부착)</h2><div class="sub">조 순서에 맞춰 각 방으로 안내합니다</div>' + ''.join(
    f'<div class="room"><b>{rooms.get(k, "")}</b><span>{n}</span></div>' for k, n in [('silence','침묵 정렬'),('quiz','말씀 퀴즈'),('secret','나만 모르는 미션')])))
P.append(page('<h2>100주년기념관 — QR 8개</h2><div class="sub">곳곳에 흩어 숨겨 붙여 주세요. 코드는 스캔이 안 될 때 직접 입력용입니다.</div><div class="g g3">' + ''.join(
    f'<div class="c"><div class="k">100주년 QR</div>{qr(c)}<div class="code">{c}</div></div>' for c, _, _ in words) + '</div>'))
P.append(page('<h2>삼육대학교회 본당 — 이야기 카드 QR 6개</h2><div class="sub">본당 곳곳에 붙여 주세요. 코드는 스캔이 안 될 때 직접 입력용입니다.</div><div class="g g3">' + ''.join(
    f'<div class="c"><div class="k">본당 QR</div>{qr(c)}<div class="code">{c}</div></div>' for c, _, _, _ in stories) + '</div>'))
open('print-qr.html', 'w', encoding='utf-8').write(f'<!doctype html><meta charset="utf-8"><title>QR 인쇄용</title><style>{CSS}</style>' + ''.join(P))

S = ['<div class="ban">스태프 전용 — 참가자에게 보이지 않게 하세요</div><h2>QR 정답표</h2>',
     '<h3>100주년 (정답 순서: 항상 → 기뻐하라 → 쉬지 → 말고 → 기도하라)</h3><table><tr><th>코드</th><th>단어</th><th>구분</th></tr>' +
     ''.join(f'<tr><td>{c}</td><td>{t}</td><td>{"정답" if ok=="true" else "함정"}</td></tr>' for c, t, ok in words) + '</table>',
     '<h3>본당 이야기 카드 (막 6:30~44, 정답 순서 1→6)</h3><table><tr><th>코드</th><th>정답 순서</th><th>표시</th><th>내용</th></tr>' +
     ''.join(f'<tr><td>{c}</td><td>{n}</td><td>{m}</td><td>{t}</td></tr>' for c, n, m, t in stories) + '</table>']
open('print-qr-staff.html', 'w', encoding='utf-8').write(f'<!doctype html><meta charset="utf-8"><title>스태프 정답표</title><style>{CSS}</style>' + ''.join(S))
print('ok', len(words), len(stories), base)
