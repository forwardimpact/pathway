universe minimal {
  domain "test.example"
  industry "technology"
  seed 42

  org testorg {
    name "Test Organization"
  }

  department eng {
    name "Engineering"
    parent testorg
    headcount 5

    team alpha {
      name "Alpha Team"
      size 5
      manager @alpha_lead
      repos ["alpha-service"]
    }
  }

  people {
    count 5
    distribution {
      J040 60%
      J050 40%
    }
    disciplines {
      software_engineering 100%
    }
  }

  project testproj {
    name "Test Project"
    type "drug"
    teams [alpha]
    prose_topic "Testing synthetic generation"
    prose_tone "technical"
  }

  framework {
    proficiencies [awareness, foundational, working, practitioner, expert]
    maturities [emerging, developing, practicing, role_modeling, exemplifying]
    stages [specify, plan, code, review]

    levels {
      J040 { title "Software Engineer" rank 1 experience "0-2 years" }
      J050 { title "Senior Engineer" rank 2 experience "2-5 years" }
    }

    capabilities {
      coding { name "Coding" skills [python_dev, code_review] }
    }

    behaviours {
      collaboration { name "Collaboration" }
    }

    disciplines {
      software_engineering {
        roleTitle "Software Engineer"
        core [python_dev]
        supporting [code_review]
      }
    }

    tracks {
      backend { name "Backend" }
    }

    drivers {
      clear_direction {
        name "Clear Direction"
        skills [python_dev]
        behaviours [collaboration]
      }
    }
  }

  scenario baseline {
    name "Baseline Scenario"
    timerange_start 2025-01
    timerange_end 2025-06

    affect alpha {
      github_commits "moderate"
      github_prs "moderate"
      dx_drivers {
        clear_direction { trajectory "rising" magnitude 3 }
      }
      evidence_skills [python_dev]
      evidence_floor "foundational"
    }
  }

  content guide_html {
    courses 2
    events 1
    blogs 3
  }
}
