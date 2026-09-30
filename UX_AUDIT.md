# AroundMe — UX consistency pass (2026-09-30, v2)

Visual design unchanged. Purpose: connect people **near each other** to **ask for help or offer help**. Nothing else.

## Core model
- The only switch: **أحتاج مساعدة / أقدر أساعد** (`ActionMode`: seek / help), same words on every screen.
  - seek → people who can help (HelperCard), help → anonymous needs (NeedCard).
- No "social / تعارف" mode anywhere. No "say hello". Every contact starts from a specific need.
- All wording lives in `COPY` at the top of `App.tsx`.

## Location is always visible
- `Loc` = { mode: gps | manual, city, area }. Shown as a location chip on Home, حولك and الكافيهات; also in Settings.
- Tab renamed **الأشخاص → حولك**. People are grouped under their café, ordered nearest first, with the distance shown.
- Distances/ETAs are computed from your area, so changing area reorders everything.
- Onboarding "أختار المدينة والحي بنفسي" opens the location picker.
- Cities that aren't live show a clear "AroundMe لسا ما وصل {city}" state with a way to change city.
- `buildData()` + `DataCtx` is the single source for lists, counts, map pins and "الأنسب", so they never disagree.

## Consent pipeline
Ask or offer → RequestSheet → PendingSheet → accepted → MatchSheet → chat. Your message is posted as yours.

## Safety / preference
- "نفس الجنس فقط" (profile + Settings) now actually filters every list and count. It was collected before but never used.
- Needs are anonymous everywhere until acceptance (including the person drawer).

## Other fixes kept from v1
Real back stack, check-in state visible everywhere, one CheckinSheet, correct café for chats,
gendered Arabic CTAs, saved cafés in Account, map reachable, derived counts, empty states with a way out.

## Profile wording
"مهاراتي واحتياجاتي": sections are **أقدر أساعد في** and **أحتاج مساعدة في** (help topics, not networking goals).
Account stats: مرة ساعدت / مرة استفدت / أماكن زرتها.

## v3 — noise reduction (no visual redesign)
- Demo reset button no longer floats over content (it covered card buttons); it only shows with `?demo` in the URL.
- Removed the verified shield from every list card (everyone is verified, so it carried no information); kept on the profile.
- Removed the green avatar dot on cards; the "الآن" badge already says it.
- "حولك": removed the extra count/title row under the filters (mode switch + filter counts already say it).
- Home and intent screens: removed sub-lines that repeated the heading.
- Café list: "مفتوح الآن" shown only when a café is closing or closed.
- Fixed stacked avatars overlapping the count line on café cards.
