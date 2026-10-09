// Firebase 설정 — 셀 데이터 그래프 메이커의 로그인 · 계정 저장에 씁니다.
// Firebase 콘솔 > 프로젝트 설정(톱니바퀴) > 일반 > 내 앱 > "SDK 설정 및 구성"에서 "구성"을 고르면 나오는
// firebaseConfig 값을 아래 따옴표 안에 그대로 붙여 넣으세요. (이 값은 공개되어도 괜찮은 값입니다. 보안은 Firestore 규칙이 지킵니다.)
// 비워 두면 로그인 버튼은 보이지만 "아직 연결되지 않음"으로 표시되고, 데이터는 브라우저에만 저장됩니다.
window.CELLGRAPH_FIREBASE = {
  apiKey: "AIzaSyCpHcN7t3C3t3FBerEI2uYU1OxHAJFv0Lc",
  authDomain: "graph-maker-abrc.firebaseapp.com",
  projectId: "graph-maker-abrc",
  storageBucket: "graph-maker-abrc.firebasestorage.app",
  messagingSenderId: "445308382919",
  appId: "1:445308382919:web:c2c2d131dd338dcd4398e2"
};
