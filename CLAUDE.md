# astb-prep — 작업 규칙

## 배포
- GitHub Pages = `main` 브랜치 root (https://sunghyunc.github.io/astb-prep/). `main`에 올라가야 폰 앱에 반영된다.
- 버전을 바꿀 때마다 `js/core.js`의 `VERSION`과 `sw.js`의 `CACHE`(`astb-vX-Y-Z`)를 **함께** 올린다(캐시 무효화).
- 새 `js/*` 또는 `data/*` 파일을 추가하면 `sw.js`의 `ASSETS`에도 넣는다.

## 같은 origin 주의 (AFOQT 앱과 공존)
- `sunghyunc.github.io`를 afoqt-vocab과 공유한다 → localStorage 키는 모두 `astb_` 접두사, 캐시는 `astb-` 접두사.
- `sw.js` activate는 `astb-` 캐시만 정리하고, 강제 업데이트는 자기 서비스워커 등록만 해제한다. 전체 캐시/등록을 지우는 코드를 넣지 말 것.

## 콘텐츠
- 원본은 `content/`(규격 `content/AUTHORING.md`, 기준값 `content/enums.json`), 앱은 `data/`만 읽는다.
- 콘텐츠를 고친 뒤: `node scripts/validate.mjs && node scripts/build_data.mjs` (validate가 OK여야 커밋).
- 4지선다, 영어 문항 + 한국어 `q_ko`·`explain`. MCT·ANIT 그림은 `fig` 파라미터(§5·§5-2)로만 — SVG를 직접 넣지 않는다. 난이도 `diff`는 1–4(§0-1).

## 구조 메모
- 빌드 없는 정적 PWA. `js/*.js`는 classic script로 순서대로 로드되고 전역 스코프를 공유한다. 최상위 실행문은 `js/boot.js`에만.
- 시험 러너(`js/exam.js`)는 AFOQT Master `app.js`의 startExam~submitExam 골격을 이식했다(섹션 타이머·스냅샷·wakeLock).
- 동기화(`js/sync.js`): `astb_app_state`(진도 JSON)·`astb_daily_log`·`astb_settings`. 큰 진도 덩어리는 **실시간 구독하지 않는다**(Supabase 무료 한도 Egress 절약) — 포그라운드 복귀 시 `pullMiscIfStale()`로 받는다.
- 예상 OAR은 비공식 추정(`js/score.js`의 `OAR_CURVE`). 화면에 항상 `OAR_NOTE`를 함께 표시.
- 적응형(CAT) 실전은 `js/cat.js` — `exam.cat` 플래그로 `exam.js` 러너에 붙는다(안내 화면·확인·채점만 분기). 문항 `diff`(1–4)가 곧 IRT 난이도 b(`CAT.B`)이므로 난이도 라벨은 AUTHORING §0-1 기준으로 정확히. 적응형 기록은 `examHist[].cat`(θ·환산 점수·경로 path — path는 동기화하지 않음).
- 그림(`fig`)은 MCT·ANIT만. 새 그림 타입은 `js/figures.js` 렌더러 + `scripts/validate.mjs` 규칙 + `content/enums.json`(figTypes/anitFigTypes/figParts) + AUTHORING §5를 함께 고친다.
