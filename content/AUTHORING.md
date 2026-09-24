# ASTB-E Prep — 문항 작성 규격 (AUTHORING)

이 문서는 `content/` 아래 모든 원본 데이터(문제은행·모의고사·용어·유형 노트·가이드)의 **단일 규격**입니다.
앱은 `node scripts/build_data.mjs`가 이 원본을 합친 `data/*.json`만 읽습니다.
토픽 키·배치 크기 등 숫자는 전부 [`enums.json`](enums.json)이 기준입니다.

작성 후 반드시 검증하세요.

```bash
node scripts/validate.mjs content/mst/batch_01.json   # 파일 하나
node scripts/validate.mjs                             # 전체 (중복·분포까지)
```

---

## 0. 공통 원칙

1. **원본 창작.** 시중 문제집·공식 샘플·웹 문항을 베끼거나 살짝 바꾸지 않는다. 형식과 난이도만 ASTB-E를 따른다.
2. **실전 형식.** 영어 문항 + **4지선다(`options` 4개), 정답 정확히 1개.** 계산기 없이 풀 수 있어야 한다.
3. **한국어 학습 보조.** `q_ko`(문항 번역)와 `explain`(한국어 해설)은 필수. 영어 용어는 괄호로 병기해도 좋다.
4. **정답 검증.** 수치가 나오는 문항(MST·MCT)은 **작성 전에 node나 python으로 직접 계산해 정답을 확인**한다. 오답 보기 3개도 계산해서 정답과 겹치지 않는지 확인한다.
5. **보기 규칙.**
   - "All of the above", "None of the above", "Both A and B" 금지.
   - 보기 앞에 `A)`, `(B)` 같은 기호를 붙이지 않는다. 앱이 붙인다.
   - 보기는 서로 달라야 하고, 길이·형식이 비슷해야 한다(정답만 유독 길면 안 됨).
   - 숫자 보기는 같은 단위·자릿수 형식으로. 오름차순 정렬을 권장하되 정답 위치는 섞는다.
6. **정답 위치 분산.** 한 배치 안에서 `answer` 0·1·2·3 중 어느 하나도 **35%를 넘지 않게**.
7. **난이도(`diff`) 분포** (배치 기준): 1(쉬움) ≈30% · 2(보통) ≈50% · 3(어려움) ≈20%.
8. **토픽 분포.** 배치 안에서 `enums.json`의 토픽을 고르게 섞는다. 아래 과목별 "가중 토픽"은 조금 더 많이.
9. **수식 표기** (앱의 `fmtMath`가 변환): `x^2`→x², `2^(n+1)`, `sqrt(49)`→√(49), `a_1`→a₁, `pi`→π, `<=`/`>=`/`!=`. 곱셈은 `×`, 나눗셈은 `÷` 또는 `/`, 음수 부호는 `-`. 분수는 `3/4`. 유니코드 `²`, `³`, `°`, `√`, `π`도 그대로 써도 된다.
10. **알 수 없는 필드 금지.** 아래 스키마에 없는 키를 넣으면 검증이 실패한다(`explanation` 같은 오타 방지).

## 1. 파일 위치와 ID

| 풀 | 파일 | 배치 크기 | ID 형식 | 배치 NN의 ID 범위 |
|---|---|---|---|---|
| MST 수학 | `content/mst/batch_NN.json` | 50 | `mst_0001` | `(NN-1)*50+1` … `NN*50` |
| RCT 독해 | `content/rct/batch_NN.json` | 40 | `rct_0001` | `(NN-1)*40+1` … `NN*40` |
| MCT 기계 | `content/mct/batch_NN.json` | 50 | `mct_0001` | `(NN-1)*50+1` … `NN*50` |
| ANIT 항공·해상 | `content/anit/batch_NN.json` | 50 | `anit_0001` | `(NN-1)*50+1` … `NN*50` |
| 용어 | `content/terms/batch_NN.json` | 100 | `t_0001` | `(NN-1)*100+1` … `NN*100` |
| 모의고사 | `content/mocks/form_a.json` (b, c) | 110 | `fa_mst_01`, `fa_rct_01` … | 섹션별 01부터 |
| 유형 노트 | `content/topics/mst.json` (rct, mct, anit) | 토픽 수 | — | — |
| 가이드 | `content/guides/guides.json` | 10 키 | — | — |

배치 파일은 **JSON 배열** 하나. `NN`은 두 자리(`01`, `02`…).

## 2. 문제 스키마 — MST · MCT · ANIT

```json
{
  "id": "mst_0001",
  "topic": "unit_conversion",
  "diff": 2,
  "q": "A runway is 9,000 feet long. About how many miles long is it? (1 mile = 5,280 feet)",
  "q_ko": "활주로 길이가 9,000피트이다. 약 몇 마일인가? (1마일 = 5,280피트)",
  "options": ["1.3 miles", "1.7 miles", "2.1 miles", "2.5 miles"],
  "answer": 1,
  "explain": "9,000 ÷ 5,280 ≈ 1.70. 5,280 × 1.7 = 8,976으로 가장 가깝다. ⚠️ 함정: 1마일을 5,000피트로 어림하면 1.8이 나와 헷갈린다.",
  "tags": ["afoqt_overlap"]
}
```

| 필드 | 필수 | 규칙 |
|---|---|---|
| `id` | ✅ | 위 표의 형식·범위 |
| `topic` | ✅ | `enums.json`의 해당 과목 토픽 키 |
| `diff` | ✅ | 1 · 2 · 3 |
| `q` | ✅ | 영어 문항. 한글 금지 |
| `q_ko` | ✅ | 자연스러운 한국어 번역 |
| `options` | ✅ | 영어(숫자·단위 포함) 4개 |
| `answer` | ✅ | 0–3 정수 |
| `explain` | ✅ | 한국어 해설 20자 이상, 보통 1–4문장(≈350자 이내) |
| `fig` | MCT만 선택 | §5 그림 규격 |
| `tags` | 선택 | 문자열 배열. 예: `afoqt_overlap`(AFOQT와 겹치는 유형), `navy`(해군 특화) |

### 해설 스타일
- **MST**: `풀이:` 뒤에 실제 계산 단계를 숫자로. 흔한 실수가 있으면 `⚠️ 함정:` 한 줄.
- **MCT**: 첫머리에 `원리:`로 어떤 원리인지 이름을 댄다(예: "원리: 움직도르래 — 받치는 줄 수만큼 힘이 나뉜다"). 이어서 계산/추론.
- **ANIT**: 사실 설명 + 필요하면 `💡 암기:` 한 줄(두문자어·연상).

## 3. 과목별 내용 가이드

### MST — Math Skills (가중 토픽: `geometry_measure`의 3D 입체, `unit_conversion`, `word_problems`의 단리·복리 이자)
- 산술·분수·비율·일차/이차 방정식·연립·지수·제곱근·간단한 로그(log₁₀ 100 = 2 수준), 각·삼각형·피타고라스, 넓이·둘레·부피(원기둥·구·원뿔·직육면체), 확률·평균·중앙값, 속력·시간·거리, 작업량, 단위 환산(ft·mi·nm·kt·gal·lb·°F↔°C), 이자·할인·나이·혼합 문장제.
- 항공·해군 맥락(연료, 항속, 활주로, 함정 속력 knots)을 30% 정도 섞으면 좋다.
- 계산기 없이 1분 안팎에 풀리는 수치로. 답이 지저분한 소수라면 보기를 "약 ~"으로.

### MCT — Mechanical Comprehension (가중 토픽: `levers`, `pulleys`, `gears_belts`, `fluids_pressure`)
- 고교 물리 수준: 뉴턴 법칙·마찰, 속도·가속도, 지렛대 3종, 도르래(받치는 줄 수), 기어·벨트(회전 방향·회전수 비), 경사면·나사·쐐기, 파스칼·유압, 베르누이·부력, 보일·샤를 법칙·열팽창, 일·에너지·일률, 4행정·제트 엔진·변속, 옴의 법칙·직렬/병렬, 전자석, 무게중심·안정성·하중 분배, 토크, 스프링 직렬/병렬, 캠·크랭크·래칫·밸브.
- **그림 문항 35–45%**: §5의 `fig`를 붙인다. 단, **문항 텍스트만으로도 풀 수 있게** 필요한 숫자를 모두 문장에 쓴다(그림은 보조).
- 개념형(계산 없이 "어느 쪽이 더 ~한가")과 계산형을 반반.

### ANIT — Aviation & Nautical Information (가중: 해상·함정·항모·계급·조함 = 전체의 **40% 이상**)
- 항공: 4가지 힘, 받음각·실속, 조종면(에일러론·엘리베이터·러더·플랩·트림), 3축, 선회·하중계수, 6대 계기와 피토-정압 계통, 왕복/제트 엔진, 활주로 번호·표지·등화·라이트 건 신호, VFR/IFR, 공역 등급, 트랜스폰더 코드(7500/7600/7700), 우선통행권, 위경도·자기편차, VOR, 기상(전선·안개·착빙·밀도고도), 헬리콥터(콜렉티브·사이클릭·자동회전).
- 해군 항공 역사: Eugene Ely, Pensacola, 1911 Curtiss, Midway·Coral Sea, 최초 제트 항모 운용 등 **검증 가능한 사실만**.
- 해상: bow/stern/port/starboard/fore/aft/amidships/bulkhead/deck/overhead/ladder/hatch/head/galley/brow, knot·fathom·nautical mile, 당직(watch)과 종(bell), 함정 선체 기호(CVN·DDG·CG·LHD·LHA·SSN·SSBN·FFG·LCS), 항모 운용(catapult·arresting wire·LSO·IFLOLS "meatball"·bolter·trap·plane guard·flight deck jersey 색), 계급(O-1 Ensign … O-10 Admiral, 부사관, Marine 대응 계급), 조함 규칙(red right returning, 항해등 적색=좌현·녹색=우현, 추월·교차·정면 상황).
- 확실하지 않은 사실은 쓰지 않는다. 연도·숫자는 널리 확인되는 것만.

## 4. RCT 스키마 — 지문 1개 = 문제 1개 (ASTB-E 형식)

```json
{
  "id": "rct_0001",
  "topic": "naval",
  "diff": 2,
  "qtype": "inference",
  "title": "Night Landings at Sea",
  "passage": "80–170 words of original English prose ...",
  "passage_ko": "지문 전체의 자연스러운 한국어 번역",
  "q": "Which of the following statements is best supported by the passage?",
  "q_ko": "다음 중 지문이 가장 잘 뒷받침하는 진술은?",
  "options": ["...", "...", "...", "..."],
  "answer": 2,
  "explain": "근거: 지문의 \"...\" 부분. (1) 지문에 없는 과잉 일반화 … (2) … (4) …"
}
```

- `qtype`: `inference`(≥80%) · `main_idea` · `detail`.
- 지문: **80–170단어**, 중립적 설명문(ASTB 스타일), 자기완결적. 주제 분포는 `enums.json`의 RCT 토픽을 섞되 **military·aviation·naval 합계 40% 이상**.
- 질문 예: "Which of the following statements is best supported by the passage?", "According to the passage, ...", "The passage most strongly suggests that ...", "The main point of the passage is that ...".
- **오답 설계 (핵심)**: 정답은 지문만으로 도출 가능해야 한다. 오답은 ① 상식적으로 사실이지만 지문에 없는 진술 ② always/all/never 같은 과잉 일반화 ③ 인과·비교 관계를 뒤집은 진술 ④ 세부를 살짝 비튼 진술.
- `explain`: 정답 근거 문장을 영어로 짧게 인용하고, 오답 각각이 왜 안 되는지 한 줄씩(보기 번호 1–4 사용).

## 5. MCT 그림(`fig`) 규격

앱이 SVG로 그린다. 아래 타입과 필드만 허용된다. 라벨 문자열은 그대로 화면에 표시된다(`?`로 구하는 값을 표시).

**lever** — 지렛대 (x는 왼쪽 끝부터의 위치, 같은 단위)
```json
{"type":"lever","length":12,"fulcrum":4,"unit":"ft",
 "items":[{"x":0,"label":"60 lb","kind":"weight"},{"x":12,"label":"F = ?","kind":"force","dir":"down"}]}
```
`length`>0, `0≤fulcrum≤length`, items 1–4개, `kind`: `weight`(매달린 추) · `force`(화살표), `dir`: `down`(기본) · `up`. 2·3종 지레는 받침점을 끝(0 또는 length)에 두고 `dir:"up"` 사용.

**pulley** — 도르래 (`strands` = 움직도르래를 받치는 줄 수. 1이면 고정도르래 하나)
```json
{"type":"pulley","strands":4,"load":"400 lb","effort":"F = ?"}
```
`strands` 1–6 정수.

**gears** — 일렬로 맞물린 기어 (왼쪽→오른쪽, 각 기어는 다음 기어와 맞물림)
```json
{"type":"gears","gears":[{"teeth":36,"label":"A"},{"teeth":12,"label":"B"},{"teeth":24,"label":"C"}],"driver":"A","dir":"cw","ask":"C"}
```
기어 2–5개, `teeth` 6–80, `driver`는 라벨, `dir`: `cw`(시계) · `ccw`, `ask`(선택)는 강조할 기어 라벨. 같은 축 복합기어는 표현 불가 → 텍스트로만.

**belt** — 벨트로 연결된 두 풀리
```json
{"type":"belt","pulleys":[{"d":4,"label":"A"},{"d":8,"label":"B"}],"unit":"in","crossed":false,"driver":"A","dir":"cw","ask":"B"}
```
`pulleys` 정확히 2개, `d`는 지름 숫자(1–20), `crossed` true면 X자 벨트(방향 반대).

**incline** — 경사면
```json
{"type":"incline","length":"12 ft","height":"3 ft","load":"240 lb","force":"F = ?"}
```
`height` 필수, `length`(빗변)나 `base`(밑변) 중 하나 이상. `force` 선택.

**hydraulic** — 유압 장치(파스칼)
```json
{"type":"hydraulic","small":{"area":"2 in²","force":"30 lb"},"large":{"area":"50 in²","force":"?"}}
```

**circuit** — 전지 + 저항
```json
{"type":"circuit","mode":"parallel","source":"12 V","resistors":["6 Ω","3 Ω"]}
```
`mode`: `series` · `parallel`, 저항 1–4개.

**springs** — 스프링 직렬/병렬
```json
{"type":"springs","mode":"series","springs":["20 lb/in","20 lb/in"],"load":"40 lb"}
```
스프링 2–3개.

**pipe** — 굵기가 변하는 관 (유속·압력)
```json
{"type":"pipe","sections":[{"d":6,"label":"A"},{"d":3,"label":"B"}],"unit":"in","flow":"right"}
```
구간 2–3개, `d` 숫자, `flow`: `right` · `left`.

## 6. 용어 스키마 — `content/terms/batch_NN.json`

```json
{"id":"t_0001","term":"Starboard","ko":"우현","def":"The right side of a ship when facing forward (toward the bow).","def_ko":"배의 앞(선수)을 보고 섰을 때 오른쪽.","category":"nautical_terms"}
```
- `category`는 ANIT 토픽 키. 해상 계열(`nautical_terms` `ship_types` `carrier_ops` `navy_org_ranks` `seamanship`) **45% 이상**.
- `term`은 영어(약어면 풀네임 병기: `"LSO (Landing Signal Officer)"`), 전체 파일에서 중복 금지.
- `def` 한 문장(≈25단어 이내), `def_ko`는 그 번역.

## 7. 유형 노트 — `content/topics/{mst,rct,mct,anit}.json`

해당 과목 `enums.json` 토픽을 **빠짐없이 한 번씩**, 같은 순서로. 단 **RCT(`topics/rct.json`)는 지문 주제가 아니라 문제 유형 `rctQtypes`(`inference` `main_idea` `detail`) 3개**를 키로 쓴다(오답 함정 유형 설명 포함).
```json
[{"key":"pulleys","ko":"도르래",
  "pts":["고정도르래: 방향만 바꿈, 힘 이득 없음","움직도르래 1개 = 힘 1/2, 줄은 2배 당김","MA = 움직도르래를 받치는 줄 수"],
  "steps":"① 움직이는 블록을 찾는다 ② 그 블록에 닿은 줄 가닥을 센다 ③ 필요한 힘 = 하중 ÷ 가닥 수",
  "trap":"당기는 줄(effort 가닥)이 위로 향하면 그것도 받치는 줄로 센다. 고정 블록 쪽 줄을 세면 틀린다.",
  "example":{"q":"A 600-lb load hangs from a block supported by 3 strands. Ignoring friction, what force lifts it?","a":"200 lb","explain":"600 ÷ 3 = 200 lb"}}]
```
- `pts` 2–6개(한국어, 공식·핵심 규칙), `steps` 한 문단, `trap` 한 문단, `example` 선택.

## 8. 모의고사 — `content/mocks/form_a.json` (b, c)

```json
{"id":"form_a","name":"ASTB-E Practice Form A","name_ko":"실전 모의고사 A",
 "sections":[
   {"code":"MST","secs":2400,"items":[ … 30 MST 문항, id "fa_mst_01" … "fa_mst_30" … ]},
   {"code":"RCT","secs":1800,"items":[ … 20 RCT 문항, id "fa_rct_01" … ]},
   {"code":"MCT","secs":900, "items":[ … 30 MCT 문항, id "fa_mct_01" … ]},
   {"code":"ANIT","secs":900,"items":[ … 30 ANIT 문항, id "fa_anit_01" … ]}]}
```
- 섹션 순서·문항 수·시간은 `enums.json`의 `mockSections`와 정확히 같아야 한다.
- 문항 스키마는 §2·§4와 동일(RCT는 `passage_ko` 포함, MCT는 `fig` 가능).
- 난이도는 실전보다 약간 어렵게: 1 ≈25% · 2 ≈45% · 3 ≈30%. 섹션 안에서 모든 토픽이 최소 1회 나오도록.
- 문제은행과 겹치지 않는 새 문항.

## 9. 가이드 — `content/guides/guides.json`

키: `overview` `mst` `rct` `mct` `anit` `pbm` `natfi` `birv` `scoring` `retake`
```json
{"mst":{"key":"mst","title":"🔢 MST 수학 공부 가이드","format":"약 30문항 · 40분 · 적응형 · 계산기 불가",
  "sections":[{"h":"시험 형식","body":"…"},{"h":"핵심 전략","body":"…"}],
  "tips":["…"],"sources":["NAMI ASTB-E 안내", "…"]}}
```
- 한국어 본문, 영어 용어 병기. 공식 확인이 필요한 수치는 "(공식 가이드로 재확인)"을 붙인다.
