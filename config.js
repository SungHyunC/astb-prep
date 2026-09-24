/* ============================================================
   Supabase 연동 설정 — AFOQT Master와 같은 Supabase 프로젝트를 쓴다.
   ------------------------------------------------------------
   ASTB 데이터는 astb_ 접두사 테이블(supabase/schema.sql)에 따로 저장되고,
   동기화 코드도 AFOQT 앱과 별개다(astb-로 시작).

   - SUPABASE_URL      : Project URL
   - SUPABASE_ANON_KEY : publishable/anon key (브라우저에 공개되어도 되는 키)

   값을 비우면 앱은 오프라인(이 기기에만 저장) 모드로 동작한다.
   ============================================================ */
window.ASTB_CONFIG = {
  SUPABASE_URL: "https://tlmihslbopfavidylikp.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable__MviWEJZbvRXVnEe32pD4w_QuwwXWpA",
};
