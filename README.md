# ASTB-E Prep ⚓

ASTB-E(미 해군·해병대 항공 선발 시험) 대비 모바일 학습 PWA.
AFOQT 대비 앱 [AFOQT Master](https://sunghyunc.github.io/afoqt-vocab/)와 같은 디자인·사용감으로, ASTB-E의 **OAR 3과목(MST·RCT·MCT) + ANIT**에 맞춰 만들었습니다.

👉 **https://sunghyunc.github.io/astb-prep/**

> 앱의 예상 OAR·준비도는 학습용 **비공식 추정**입니다. 실제 ASTB-E 환산·척도와 다를 수 있어요.
> 문항·해설은 학습용으로 새로 작성한 원본이며 공식 기출이 아닙니다.

---

## ✨ 무엇이 들어있나

| 과목 | 실전 형식 (공개 자료 기준·재확인 필요) | 앱 콘텐츠 |
|---|---|---|
| 🔢 **MST** Math Skills | 약 30문항 · 40분 · 적응형 · 계산기 불가 | 200문항 · 13유형 (3D 입체·단위환산·이자 가중) |
| 📖 **RCT** Reading Comprehension | 약 20문항 · 30분 · 적응형 | 120지문 (한글 번역 포함) · 추론형 80%+ |
| ⚙️ **MCT** Mechanical Comprehension | 약 30문항 · 15분 · 적응형 | 200문항 · 17유형 · **그림 문항 75개** (지렛대·도르래·기어·벨트·경사면·유압·회로·스프링·관) |
| ✈️ **ANIT** Aviation & Nautical Info | 약 30문항 · 15분 | 250문항 (해상 40%) + **용어 카드 300개** |
| 📘 **모의고사** | — | 고정 Form A·B·C (각 110문항) + 문제은행에서 새로 구성하는 OAR·학과 전체·진단 미니 |
| 🕹️ PBM · NATFI · BI-RV | 실기·성향·경험 설문 | 안내 가이드 (PBM 시뮬레이터는 2단계 예정) |

### 핵심 기능
- **유형별 드릴** — 유형 노트(핵심 원리·푸는 순서·함정·예제) → 해설 즉시 10문제 / 시간 제한 10문제.
- **실전 모드** — 섹션별 타이머, **되돌아가기 금지**(적응형 재현: 답을 골라 '확인'해야 다음으로), 중단 복구, 화면 꺼짐 방지.
- **오답노트 + 틀린 이유 4분류** — ① 원리 모름 ② 적용 실수 ③ 계산 실수 ④ 시간 부족. 첫 오답은 3일 뒤, 다시 틀리면 1일 뒤, 연속 2번 맞히면 졸업.
- **초반 5문제 정확도** — 적응형 시험에서 점수를 좌우하는 섹션 첫 5문항을 따로 기록.
- **예상 OAR(비공식) · 과목 준비도 · 점수 추이 · 약점 유형 · 풀이 속도.**
- **응시 Go / No-Go** — MST·MCT·ANIT 80%+ · 서로 다른 모의고사 2회 연속 목표권 · PBM 10세션 · 최근 2주 '원리 모름' 0건.
- **플랜** — Phase 0(겸용) → Phase 1(진단 1주) → Phase 2(집중 10주), 요일 사이클(월·화 원리 → 수·목 드릴 → 금 PBM·오답 → 토 시간 제한 세트 → 일 오답 정리), 오늘 할 일 자동 체크.
- **ANIT 용어 플래시카드** — SM-2 간격반복, 해상 용어 먼저.
- **PBM 연습 기록 · 실전 점수 기록 (OAR/AQR/PFAR/FOFAR).**
- **기기 간 동기화**(Supabase, 동기화 코드) · **오프라인 PWA** · 진도 백업/복원.

---

## 🔄 동기화 (Supabase)
AFOQT 앱과 **같은 Supabase 프로젝트**를 쓰고, 테이블만 `astb_` 접두사로 따로 둡니다.

1. Supabase → 프로젝트 → **SQL Editor** → [`supabase/schema.sql`](supabase/schema.sql) 전체 붙여넣고 **RUN** (여러 번 실행해도 안전, AFOQT 테이블은 안 건드림).
2. [`config.js`](config.js)에 URL·publishable key (이미 입력됨).
3. 앱 ⚙️ 설정 → **동기화 코드** 복사 → 다른 기기 ⚙️ → **↘︎ 다른 코드**에 붙여넣기.

전송량(Egress) 절약: 진도 덩어리(`astb_app_state`)는 실시간 구독하지 않고, 앱을 다시 열거나 포커스할 때 받아옵니다. 업로드는 학습 중 최대 6초에 한 번 묶어서 보냅니다.

## 📱 설치
- iPhone(Safari): 공유 → **홈 화면에 추가** · Android(Chrome): ⋮ → **앱 설치**
- 업데이트가 안 보이면 ⚙️ → **🔄 강제 업데이트** (ASTB 앱 캐시만 지우고, 같은 도메인의 AFOQT 앱은 건드리지 않음)

---

## 🛠 개발

순수 정적 PWA — 빌드 도구 없음.

```bash
python3 scripts/devserver.py          # http://localhost:8765 (캐시 끔)
node scripts/validate.mjs             # 콘텐츠 규격·중복·분포 검증
node scripts/build_data.mjs           # content/ → data/ 합치기
node scripts/stats.mjs                # 토픽·난이도·정답 위치 분포
```

| 경로 | 설명 |
|---|---|
| `index.html` · `app.css` | 앱 셸·스타일 (디자인 토큰은 AFOQT Master에서 가져옴) |
| `js/core.js` | 상수·헬퍼·상태 저장·오답노트·용어 SM-2 |
| `js/data.js` | 데이터 로드·색인·출제 |
| `js/figures.js` | MCT 그림 SVG 렌더러 (9종) |
| `js/score.js` | 예상 OAR·준비도·Go/No-Go |
| `js/exam.js` | 시험 엔진 (섹션 타이머·되돌아가기 금지·스냅샷·채점) |
| `js/sync.js` | Supabase 동기화 |
| `js/views.js` | 화면·라우터·플랜·설정 |
| `js/boot.js` | 서비스워커·부팅 |
| `content/` | **원본 콘텐츠** (배치 파일) — 규격은 [`content/AUTHORING.md`](content/AUTHORING.md) |
| `data/` | 앱이 읽는 빌드 결과 (`build_data.mjs`가 생성) |
| `supabase/schema.sql` | `astb_` 테이블·RLS·Realtime |
| `sw.js` · `manifest.webmanifest` · `icon.svg` | PWA |

문항을 추가할 때: `content/<과목>/batch_NN.json` 작성 → `validate` → `build_data` → `sw.js`의 `CACHE`와 `js/core.js`의 `VERSION` 올리기.

## 🔒 보안 메모
개인용이라 로그인 대신 추측 불가능한 **동기화 코드**로 데이터를 구분합니다(AFOQT 앱과 같은 방식). publishable key는 공개되어도 되는 키입니다.
