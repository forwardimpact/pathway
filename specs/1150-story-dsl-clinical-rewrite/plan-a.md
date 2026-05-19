# 1150 — Story DSL Clinical Domain Rewrite: Plan

## Approach

Write the concrete `story.dsl` changes — the `clinical {}` block, new projects, new scenarios, updated datasets, and new outputs — in a single file modification. This plan produces no library code; it exercises all library changes from spec 1140. All 8 parts of the 1140 plan should be implemented before executing this one, because this file exercises the full grammar, entity generation, prose key collection, rendering, and pipeline.

Libraries used: none (DSL content only).

## Files

| Action | Path |
|--------|------|
| Modified | `data/synthetic/story.dsl` |

## Step 1 — Add `clinical {}` block

Insert after the last `content` block (line 772) and before the datasets section (line 774).

### 6 conditions

| id | name | synthea_module | therapeutic_area |
|----|------|----------------|------------------|
| `lung_cancer` | Non-Small Cell Lung Cancer | `lung_cancer` | oncology |
| `diabetes_t2` | Type 2 Diabetes Mellitus | `diabetes` | endocrinology |
| `cardiovascular` | Cardiovascular Disease | `cardiovascular_disease` | cardiology |
| `breast_cancer` | HER2-Positive Breast Cancer | `breast_cancer` | oncology |
| `hypertension` | Hypertension | `hypertension` | cardiology |
| `copd` | Chronic Obstructive Pulmonary Disease | `copd` | pulmonology |

Each with `icd10`, `synonyms`, `severity`, `prose_topic`, `prose_tone`.

### 5 sites

Cambridge main (500 cap), Boston clinical (200), New York satellite (300), Chicago research (250), San Francisco trials (150). Each with address, city, state, country, `org headquarters`, specialties.

### 6 trials

| id | phase | status | conditions | PI |
|----|-------|--------|------------|-----|
| `oncora_phase3` | Phase 3 | recruiting | lung_cancer | @thoth |
| `oncora_phase1` | Phase 1 | completed | lung_cancer | @thoth |
| `cardio_outcomes` | Phase 3 | recruiting | cardiovascular, hypertension | @chronos |
| `diabetes_prevention` | Phase 2 | active_not_recruiting | diabetes_t2 | @hygieia |
| `her2_combo` | Phase 2 | recruiting | breast_cancer | @asclepius |
| `copd_inhaler` | Phase 1 | not_yet_recruiting | copd | @apollo |

Each with full `criteria {}` blocks (inclusion: age range, conditions_required, prior_treatments, ecog_max, custom strings; exclusion: conditions_excluded, autoimmune/immunotherapy booleans, custom strings), 2-3 arms, and prose context.

### Clinical content

```dsl
content {
  condition_explainers per_condition
  therapy_descriptions 6
  therapy_topics [mab_therapy, immunotherapy, targeted_therapy,
                  chemotherapy, radiation, clinical_trials_101]
  trial_faqs per_trial
  consent_summaries per_trial
  site_descriptions per_site
  patient_stories 10
  patient_story_conditions [lung_cancer, diabetes_t2,
                            cardiovascular, breast_cancer]
}
```

**Verify:** `bun test` in `libsyntheticgen` — parse the rewritten file.

## Step 2 — Add 3 new projects

Insert after the existing `project cross_func_initiative` block.

```dsl
project finder { ... }          — Clinical Research Finder
project patient_portal { ... }  — BioNova Patient Portal
project trial_management { ... } — BioNova Trial Management System
```

Each with `teams`, `timeline_start/end`, `milestones`, `risks`, `technical_choices`. Verify that team IDs (`platform_engineering`, `developer_experience`, `clinical_development`, `enterprise_applications`, `security_compliance`, `data_science_ai`) exist in the DSL's department/team hierarchy.

**Verify:** `ast.projects.length === 8` (5 existing + 3 new).

## Step 3 — Add 2 new scenarios

Insert after the existing `scenario one_bionova` block.

- `scenario finder_mvp_push` — affects `platform_engineering`, `developer_experience`, `clinical_development`. Timerange 2025-06 to 2025-09.
- `scenario finder_ga_release` — affects `platform_engineering`, `developer_experience`. Timerange 2025-10 to 2026-03.

Each with `affect` blocks containing `github_commits`, `github_prs`, `dx_drivers`, `evidence_skills`, `evidence_floor`.

**Verify:** `ast.scenarios.length === 7` (5 existing + 2 new).

## Step 4 — Update dataset block

Replace the `trial_patients` block (lines 776-780):

```dsl
dataset trial_patients {
  tool synthea
  population 200
  conditions [lung_cancer, diabetes_t2, cardiovascular,
              breast_cancer, hypertension, copd]
}
```

**Verify:** `ast.datasets` contains `trial_patients` with `config.conditions`.

## Step 5 — Remove researchers dataset

Delete the `dataset researchers { ... }` block (lines 791-802) and its output blocks (`researchers yaml` at line 811, `researchers markdown` at line 812).

**Verify:** `ast.datasets.length === 2` (trial_patients + claims).

## Step 6 — Add new output blocks

After the existing output blocks (keeping `claims_claims` outputs):

```dsl
output finder_seed supabase_migration {
  path "products/finder/site/supabase/migrations/"
  prefix "seed"
  entities [clinical.conditions, clinical.sites,
            clinical.researchers, clinical.trials, clinical.criteria]
  include_embeddings true
}

output finder_embeddings embeddings_jsonl {
  path "products/finder/site/supabase/migrations/seed_embeddings.jsonl"
  entities [clinical.conditions, clinical.trials]
  text_fields {
    clinical.conditions [name, synonyms, prose_explainer]
    clinical.trials [name, therapeutic_area, arms, prose_description]
  }
}
```

**Verify:** `ast.outputs` contains `finder_seed` and `finder_embeddings` with correct formats.

## Step 7 — Keep unchanged

All existing blocks (org, departments, teams, standard, snapshots, 5 existing projects, 5 existing scenarios, `claims` dataset, `claims_claims` outputs) remain untouched.

## Risks

- **PI @refs may not match existing people.** Mitigated by verifying `@thoth`, `@chronos`, `@hygieia`, `@asclepius`, `@apollo` exist as manager aliases in the people graph before writing. If any are missing, substitute with existing manager refs.
- **Team IDs may not match existing hierarchy.** Mitigated by checking team IDs in the DSL before referencing them in new projects/scenarios.

## Verification

### Parse test

```sh
cd libraries/libsyntheticgen && bun test
```

### Parse output inspection

```sh
node -e "
  import { tokenize } from './src/dsl/tokenizer.js';
  import { parse } from './src/dsl/parser.js';
  import { readFileSync } from 'fs';
  const src = readFileSync('../../data/synthetic/story.dsl', 'utf-8');
  const ast = parse(tokenize(src));
  console.log('clinical:', ast.clinical !== null);
  console.log('conditions:', ast.clinical.conditions.length);
  console.log('sites:', ast.clinical.sites.length);
  console.log('trials:', ast.clinical.trials.length);
  console.log('projects:', ast.projects.length);
  console.log('scenarios:', ast.scenarios.length);
  console.log('datasets:', ast.datasets.length);
"
```

Expected: clinical: true, conditions: 6, sites: 5, trials: 6, projects: 8, scenarios: 7, datasets: 2.

### Full pipeline smoke test

```sh
bun run fit-terrain generate --mode no-prose
ls -la output/products/finder/site/supabase/migrations/
```

Verify SQL migrations and embeddings JSONL are generated. Existing outputs (claims) still generate.
