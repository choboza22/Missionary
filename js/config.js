// ===== 행사 설정 (여기만 고치면 됩니다) =====
window.CONFIG = {
  title: '쉼을 찾아서',
  verseRef: '마태복음 11:29',
  // Google Apps Script 웹앱 주소(/exec). 비워두면 기도문·사진·진행상황은 이 폰에만 저장됩니다.
  // 설정 방법: README.md 의 "백엔드 설정" 참고
  endpoint: '',
  // 선택: 지도 이미지를 assets/map.png 로 넣으면 지도 화면에 보입니다.
  mapImage: 'assets/map.png',
  groups: 6,
  // 신학관 방 안내(스태프가 확정 후 입력). 비워두면 "스태프 안내"로 표시됩니다.
  // 예: rooms: { silence: { 1: '신학관 201호', 2: '신학관 202호' }, ... }
  rooms: {},
};
