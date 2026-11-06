// 사용: node tools/make_pdf.js <입력.html> <출력.pdf>  (playwright 필요)
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + require('path').resolve(process.argv[2]));
  await p.pdf({ path: process.argv[3], format: 'A4', printBackground: true });
  await b.close();
})();
