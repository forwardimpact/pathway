// default.dsl — Minimal synthetic data universe for testing
// A small engineering company with 2 departments, 3 teams, 20 people

universe Default {
  domain "example.dev"
  industry "technology"
  seed 1

  org hq {
    name "Acme Engineering"
    location "London, UK"
  }

  department engineering {
    name "Engineering"
    parent hq
    headcount 15

    team backend {
      name "Backend Team"
      size 6
      manager @athena
      repos ["api-service", "data-pipeline"]
    }

    team frontend {
      name "Frontend Team"
      size 5
      manager @hermes
      repos ["web-app", "design-system"]
    }
  }

  department product {
    name "Product"
    parent hq
    headcount 5

    team product_ops {
      name "Product Ops Team"
      size 4
      manager @artemis
      repos ["analytics-dashboard"]
    }
  }

  people {
    count 20
    names "greek_mythology"
    distribution {
      L1 30%
      L2 30%
      L3 20%
      L4 15%
      L5 5%
    }
    disciplines {
      software_engineering 70%
      data_engineering 20%
      engineering_management 10%
    }
  }

  project alpha {
    name "Project Alpha"
    type "product"
    teams [backend, frontend]
    timeline_start 2025-01
    timeline_end 2025-12
    prose_topic "next-generation API platform"
    prose_tone "technical"
  }

  snapshots {
    quarterly_from 2025-01
    quarterly_to 2025-07
    account_id "acct_default_001"
  }

  scenario alpha_push {
    name "Alpha Launch Push"
    timerange_start 2025-03
    timerange_end 2025-06

    affect backend {
      github_commits "elevated"
      github_prs "moderate"
      dx_drivers {
        deep_work { trajectory "declining" magnitude -4 }
        ease_of_release { trajectory "declining" magnitude -3 }
      }
      evidence_skills [architecture_design]
      evidence_floor "working"
    }

    affect frontend {
      github_commits "moderate"
      github_prs "moderate"
      dx_drivers {
        connectedness { trajectory "rising" magnitude 3 }
      }
      evidence_skills [team_collaboration]
      evidence_floor "foundational"
    }
  }

  framework {
    proficiencies [awareness, foundational, working, practitioner, expert]
    maturities [emerging, developing, practicing, role_modeling, exemplifying]
    capabilities [delivery, scale, reliability]
  }

  content guide_html {
    articles 1
    article_topics [engineering_culture]
    blogs 2
    faqs 3
    howtos 1
    howto_topics [getting_started]
    reviews 3
    comments 5
    courses 2
    events 2
  }

  content basecamp_markdown {
    personas 2
    persona_levels [L2, L3]
    briefings_per_persona 2
    notes_per_persona 3
  }
}
