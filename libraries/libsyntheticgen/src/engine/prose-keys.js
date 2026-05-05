/**
 * Prose Keys — collects all keys that need LLM-generated prose.
 *
 * Each key maps to a context object that guides the LLM prompt.
 */

/**
 * Add guide HTML content keys (articles, blogs, FAQs, etc).
 * @param {Map<string, object>} keys
 * @param {object} guideContent
 * @param {string} domain
 * @param {string} orgName
 */
function addGuideContentKeys(keys, guideContent, domain, orgName) {
  for (const topic of guideContent.article_topics || []) {
    keys.set(`article_${topic}`, {
      topic: `${topic.replace(/_/g, " ")} in pharmaceutical industry`,
      tone: "technical, informative",
      length: "6-8 paragraphs",
      domain,
      orgName,
    });
  }

  for (let i = 0; i < (guideContent.blogs || 0); i++) {
    keys.set(`blog_${i}`, {
      topic: "pharmaceutical engineering blog post",
      tone: "conversational, technical",
      length: "4-5 paragraphs",
      domain,
      orgName,
    });
  }

  for (let i = 0; i < (guideContent.faqs || 0); i++) {
    keys.set(`faq_${i}`, {
      topic: "pharmaceutical engineering FAQ",
      tone: "helpful, concise",
      length: "1 paragraph",
      domain,
      orgName,
    });
  }

  for (const topic of guideContent.howto_topics || []) {
    keys.set(`howto_${topic}`, {
      topic: `how-to guide for ${topic.replace(/_/g, " ")}`,
      tone: "instructional",
      length: "5-6 paragraphs",
      domain,
      orgName,
    });
  }

  for (let i = 0; i < (guideContent.reviews || 0); i++) {
    keys.set(`review_${i}`, {
      topic: "peer review comment on engineering work",
      tone: "professional, constructive",
      length: "1-2 sentences",
      maxTokens: 100,
      domain,
      orgName,
    });
  }

  for (let i = 0; i < (guideContent.comments || 0); i++) {
    keys.set(`comment_${i}`, {
      topic: "discussion comment on engineering topic",
      tone: "casual, technical",
      length: "1-2 sentences",
      maxTokens: 80,
      domain,
      orgName,
    });
  }
}

/**
 * Add outpost persona keys (briefings, notes).
 * @param {Map<string, object>} keys
 * @param {object} outpostContent
 * @param {object} entities
 * @param {string} domain
 * @param {string} orgName
 */
function addOutpostKeys(keys, outpostContent, entities, domain, orgName) {
  const personas = selectPersonaNames(entities, outpostContent);
  for (const persona of personas) {
    for (let i = 0; i < (outpostContent.briefings_per_persona || 0); i++) {
      keys.set(`briefing_${persona.name}_${i}`, {
        topic: `daily briefing for ${persona.name}, a ${persona.level} ${persona.discipline}`,
        tone: "professional, concise",
        length: "2-3 paragraphs",
        domain,
        orgName,
        role: `${persona.level} ${persona.discipline}`,
      });
    }

    for (let i = 0; i < (outpostContent.notes_per_persona || 0); i++) {
      keys.set(`note_${persona.name}_${i}`, {
        topic: `engineering knowledge note by ${persona.name}`,
        tone: "personal, technical",
        length: "1-2 paragraphs",
        domain,
        orgName,
        role: `${persona.level} ${persona.discipline}`,
      });
    }
  }
}

/**
 * Add snapshot comment keys.
 * @param {Map<string, object>} keys
 * @param {object[]} commentKeys
 * @param {string} domain
 * @param {string} orgName
 */
function addSnapshotCommentKeys(keys, commentKeys, domain, orgName) {
  for (const ck of commentKeys) {
    const direction = ck.trajectory === "declining" ? "declining" : "improving";
    keys.set(
      `snapshot_comment_${ck.snapshot_id}_${ck.email.replace(/[@.]/g, "_")}`,
      {
        topic: `GetDX snapshot survey comment about ${ck.driver_name.toLowerCase()}`,
        tone: "authentic, first-person developer voice",
        length: "1-2 sentences",
        maxTokens: 80,
        domain,
        orgName,
        role: `${ck.person_level} ${ck.person_discipline.replace(/_/g, " ")} on the ${ck.team_name}`,
        scenario: ck.scenario_name,
        driver: ck.driver_name,
        direction,
        magnitude: ck.magnitude,
      },
    );
  }
}

/**
 * Collect all prose keys from the entity graph.
 * @param {object} entities - Generated entity graph from tier0
 * @returns {Map<string, object>} key -> context for prose generation
 */
export function collectProseKeys(entities) {
  const keys = new Map();
  const orgName = entities.orgs[0]?.name || "BioNova";
  const domain = entities.domain;

  keys.set("org_readme", {
    topic: `${orgName} company overview`,
    tone: "corporate, informative",
    length: "3-4 paragraphs",
    domain,
    orgName,
  });

  for (const proj of entities.projects) {
    if (proj.prose_topic) {
      keys.set(`project_${proj.id}`, {
        topic: proj.prose_topic,
        tone: proj.prose_tone || "technical",
        length: "2-3 paragraphs",
        domain,
        orgName,
      });
    }
  }

  const guideContent = entities.content.find((c) => c.id === "guide_html");
  if (guideContent) {
    addGuideContentKeys(keys, guideContent, domain, orgName);
  }

  const outpostContent = entities.content.find(
    (c) => c.id === "outpost_markdown",
  );
  if (outpostContent) {
    addOutpostKeys(keys, outpostContent, entities, domain, orgName);
  }

  if (entities.activity?.commentKeys) {
    addSnapshotCommentKeys(
      keys,
      entities.activity.commentKeys,
      domain,
      orgName,
    );
  }

  if (entities.activity?.webhookKeys) {
    addWebhookProseKeys(keys, entities.activity.webhookKeys, domain, orgName);
  }

  return keys;
}

/**
 * Add webhook prose keys for PR descriptions and review bodies.
 * @param {Map<string, object>} keys
 * @param {object[]} webhookKeys
 * @param {string} domain
 * @param {string} orgName
 */
function addWebhookProseKeys(keys, webhookKeys, domain, orgName) {
  for (const wk of webhookKeys) {
    if (wk.prose_type === "pr_body") {
      keys.set(`pr_body_${wk.delivery_id}`, {
        topic:
          `Pull request description for "${wk.title}" in ${wk.repo} ` +
          `(${wk.additions} additions, ${wk.deletions} deletions, ${wk.changed_files} files)`,
        tone: "technical, first-person developer voice",
        length: "2-4 sentences",
        maxTokens: 200,
        domain,
        orgName,
        role: `${wk.person_level} ${wk.person_discipline} on the ${wk.team_name}`,
        scenario: wk.scenario_name,
        drivers: wk.drivers,
      });
    }

    if (wk.prose_type === "review_body") {
      keys.set(`review_body_${wk.delivery_id}`, {
        topic: `Code review (${wk.review_state}) on a PR in ${wk.repo}`,
        tone: "professional, reviewer voice",
        length: "1-3 sentences",
        maxTokens: 150,
        domain,
        orgName,
        role: `${wk.person_level} ${wk.person_discipline} on the ${wk.team_name}`,
        scenario: wk.scenario_name,
        drivers: wk.drivers,
      });
    }
  }
}

/**
 * Select persona representatives from people.
 */
function selectPersonaNames(entities, outpostContent) {
  const levels = outpostContent.persona_levels || [
    "L1",
    "L2",
    "L3",
    "L4",
    "L5",
  ];
  const personas = [];
  for (const level of levels) {
    const person = entities.people.find((p) => p.level === level);
    if (person) {
      personas.push({
        name: person.name,
        level: person.level,
        discipline: person.discipline,
        email: person.email,
        team_id: person.team_id,
      });
    }
  }
  return personas;
}
