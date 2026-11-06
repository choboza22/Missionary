# 쉼을 찾아서 (연합예배 레크 미션 웹앱)

11/7 연합예배 레크용 모바일 웹앱. 빌드 없는 정적 사이트(HTML/CSS/JS)이며 로그인이 필요 없습니다. 기획: 기획안 v14.

## 기능
랜딩 → 조·이름 입력(리더는 조원 명단) → 로드맵/다음 장소 안내 → 미션(침묵 정렬 키워드, 나만 모르는 미션 타이머, 퀴즈, 100주년 QR 말씀 찾기+기도 사진 업로드, 오얏봉 한 줄 기도, 본당 이야기 카드 순서 맞추기, 청년관 말씀 완성) → 지도 · 말씀 조각 현황. 조별 신학관 순서는 기획안대로 자동 적용됩니다.

## 배포 (GitHub Pages, 약 3분)
1. 저장소 Settings → Pages → Source 를 **GitHub Actions** 로 선택.
2. main 에 병합하면 자동 배포 → `https://choboza22.github.io/Missionary/`
3. 이 주소를 QR로 만들어 시작 화면에 띄우거나 `print-qr-start.html` 인쇄.

## 백엔드 설정 (사진·기도문 저장, 선택)
설정하지 않아도 앱은 동작하며(사진은 스태프에게 화면 확인), 설정하면 기도문(시트)·사진(Drive)·진행상황이 저장됩니다. 참가자는 로그인하지 않습니다.
1. 새 구글 시트 → 확장 프로그램 → Apps Script → `apps-script/Code.gs` 내용 붙여넣기.
2. 배포 → 새 배포 → 유형 **웹 앱**, 실행 계정 **나**, 액세스 **모든 사용자** → 배포 후 `/exec` 주소 복사.
3. `js/config.js` 의 `endpoint` 에 붙여넣고 커밋(처음 실행 시 Drive 권한 승인 필요).
4. 스태프 현황판: `…/staff.html` (조별 진행 상황).
전송 실패 시 폰에 대기열로 보관했다가 다시 보냅니다.

## QR 인쇄
`python3 tools/gen_qr.py https://choboza22.github.io/Missionary/` (segno 필요: `pip install segno`) → `print-qr.html`(100주년 단어 QR 8개[w1~w5 정답, x1~x3 함정], 본당 카드 QR 6개 s1~s6). 코드는 QR 아래에 적혀 있어 스캔이 안 되면 직접 입력할 수 있습니다.

## 행사 전 확인
- `js/config.js`: 신학관 방 번호(`rooms`), `endpoint`
- (선택) `assets/map.png` 에 캠퍼스 지도 넣기
- 미션 내용 수정은 `js/data.js`
