# 1140 Part 07 — Clinical HTML Templates + Rendering

Add 7 HTML templates for clinical content and a `renderClinicalPages()` function that follows the existing two-pass pattern: Pass 1 renders Mustache templates with `data-enrich` placeholders and Schema.org microdata; Pass 2 (enricher.js, unchanged) fills prose blocks via LLM.

## Goal

Clinical HTML pages plug into the existing `renderHTML()` → `enriched` → `write` pipeline path. The `data-enrich` keys use the `clinical_` prefix from Part 03's prose key generator, so the enricher picks them up automatically.

## Files

| Action | Path |
|--------|------|
| Modified | `libraries/libsyntheticrender/src/render/html.js` |
| Created | `libraries/libsyntheticrender/templates/condition-explainer.html` |
| Created | `libraries/libsyntheticrender/templates/therapy-description.html` |
| Created | `libraries/libsyntheticrender/templates/trial-faq.html` |
| Created | `libraries/libsyntheticrender/templates/consent-summary.html` |
| Created | `libraries/libsyntheticrender/templates/site-description.html` |
| Created | `libraries/libsyntheticrender/templates/patient-story.html` |
| Created | `libraries/libsyntheticrender/templates/trial-card.html` |
| Created | `libraries/libsyntheticrender/test/render-clinical-html.test.js` |

## Steps

### Step 1 — HTML templates

Seven templates with Schema.org microdata:

| Template | Schema.org Type | `data-enrich` key pattern |
|----------|----------------|--------------------------|
| `condition-explainer.html` | `MedicalCondition` | `clinical_condition_explainer_{id}` |
| `therapy-description.html` | `MedicalTherapy` | `clinical_therapy_description_{topic}` |
| `trial-faq.html` | `MedicalTrial` | `clinical_trial_faq_{id}` |
| `consent-summary.html` | `MedicalTrial` | `clinical_consent_summary_{id}` |
| `site-description.html` | `MedicalClinic` | `clinical_site_description_{id}` |
| `patient-story.html` | `MedicalCondition` | `clinical_patient_story_{condId}_{i}` |
| `trial-card.html` | `MedicalTrial` | (none — all entity data) |

Each template uses `itemscope`, `itemtype`, `itemprop` attributes for structured data. Prose blocks are wrapped in `data-enrich` elements with fallback text from entity fields.

**Verify:** Files exist in `libraries/libsyntheticrender/templates/`.

### Step 2 — renderClinicalPages()

Add `renderClinicalPages(files, entities, prose, templates, domain)` to `html.js` after `renderContentPages()`. The function builds template data from entities and prose, renders via the template loader, and wraps in `page()`.

Produces 7 files:
- `condition-explainers.html` — one section per condition with ICD-10, synonyms, related trial links.
- `therapy-descriptions.html` — one section per therapy topic.
- `trial-faqs.html` — one section per trial with condition links, sponsor.
- `consent-summaries.html` — one section per trial with eligibility summary.
- `site-descriptions.html` — one section per site with address, specialties, active trial links.
- `patient-stories.html` — one section per story (condition × index).
- `trial-cards.html` — compact cards for search results, no `data-enrich`.

**Verify:** `bun test` in `libsyntheticrender`.

### Step 3 — Wire into renderHTML()

In `renderHTML()` (`html.js:385-409`):

```javascript
if (entities.clinical) {
  renderClinicalPages(files, entities, prose, templates, domain);
}
```

**Verify:** `bun test` in `libsyntheticrender`.

### Step 4 — Tests

Build a minimal `entities` fixture with `entities.clinical` (2 conditions, 1 site, 1 trial with criteria, content spec). Mock prose cache and template loader.

- File count — 7 HTML files produced.
- Schema.org microdata — correct `itemtype` URLs.
- `data-enrich` keys — correct patterns in each file.
- Prose fallback — empty cache → fallback strings.
- Prose populated — cache entries appear in output.
- Trial-card has no `data-enrich`.
- No clinical block — zero clinical HTML files, existing files unaffected.
- IRI references — condition `<link itemprop="study">` → trial IRIs; site `<link itemprop="availableService">` → recruiting trial IRIs only.

## Blast Radius

Created: 7 templates, `render-clinical-html.test.js`. Modified: `html.js`.

## Verification

```sh
cd libraries/libsyntheticrender && bun test
```
