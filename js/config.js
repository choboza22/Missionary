// ===== 행사 설정 (여기만 고치면 됩니다) =====
window.CONFIG = {
  title: '쉼을 찾아서',
  verseRef: '마태복음 11:29',
  // Google Apps Script 웹앱 주소(/exec). 비워두면 기도문·사진·진행상황은 이 폰에만 저장됩니다.
  // 설정 방법: README.md 의 "백엔드 설정" 참고
  endpoint: 'https://script.google.com/macros/s/AKfycby9-j8HBvRwSua8buSIKPT4-dHsACAtWDQB42FnS_Wzf1dtyd_nwWCxCgjI-EhNneR2hQ/exec',
  // 선택: 지도 이미지를 assets/map.png 로 넣으면 지도 화면에 보입니다.
  mapImage: 'assets/map.png',
  groups: 6,
  // 신학관 방 (미션별)
  rooms: { quiz: '신학관 201호', secret: '신학관 202호', silence: '신학관 203호' },
};
