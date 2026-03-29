/**
 * HTML Renderer — generates HTML microdata files for Guide.
 *
 * Uses TemplateLoader from libtemplate for all output.
 * Pass 1: Deterministic templates produce complete HTML with structural microdata.
 * Pass 2: LLM enricher rewrites prose blocks in-place (handled by enricher.js).
 */

import { generateDrugs, generatePlatforms } from "./industry-data.js";
import { assignLinks } from "./link-assigner.js";

const FAQ_QUESTIONS = [
  "What is pharmaceutical engineering and what does it involve?",
  "How does computational chemistry accelerate drug discovery?",
  "What are the key phases of clinical trial development?",
  "How does GMP compliance affect manufacturing processes?",
  "What role does data science play in pharmaceutical R&D?",
  "How are biomarkers used in drug development?",
  "What is the drug approval process and how long does it take?",
  "How does continuous manufacturing differ from batch processing?",
  "What are the main challenges in scaling up drug production?",
  "How do platform engineering teams support drug discovery?",
  "What regulatory frameworks govern pharmaceutical development?",
  "How is AI being used in drug candidate screening?",
  "What quality control measures ensure drug safety?",
  "How does real-world evidence complement clinical trials?",
  "What are the key considerations for biologics manufacturing?",
  "How do cross-functional teams collaborate in drug development?",
  "What is the role of process analytical technology in manufacturing?",
  "How are digital twins used in pharmaceutical engineering?",
  "What sustainability practices are used in drug manufacturing?",
  "How does pharmacovigilance work after drug approval?",
  "What are the differences between small molecule and biologic drugs?",
  "How do adaptive trial designs improve clinical development?",
  "What is the role of observability in manufacturing systems?",
  "How are cloud platforms used in pharmaceutical data management?",
  "What are the key challenges in supply chain management for pharma?",
  "How does formulation science affect drug delivery?",
  "What are the best practices for laboratory data management?",
  "How do engineering teams handle regulatory submission preparation?",
  "What is the role of DevOps in pharmaceutical software systems?",
  "How are patient-reported outcomes used in clinical development?",
  "What are the principles of quality by design in drug manufacturing?",
  "How does risk management apply to pharmaceutical engineering?",
  "What emerging technologies are transforming drug development?",
  "How do companies manage intellectual property in pharma R&D?",
  "What role does environmental monitoring play in GMP facilities?",
];

/** Wrap inner HTML in the page shell. */
function page(templates, title, body, domain) {
  return templates.render("page.html", {
    title,
    body,
    domain: `https://${domain}`,
  });
}

function titleCase(str) {
  return str.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Render HTML microdata files from entities and prose.
 * @param {object} entities
 * @param {Map<string,string>} prose
 * @param {import('@forwardimpact/libtemplate/loader').TemplateLoader} templates - Template loader
 * @returns {{ files: Map<string,string>, linked: import('./link-assigner.js').LinkedEntities }}
 */
export function renderHTML(entities, prose, templates) {
  if (!templates) throw new Error("templates is required");
  const files = new Map();
  const domain = entities.domain;

  // Generate industry data
  const drugs = generateDrugs(domain);
  const platforms = generatePlatforms(domain);

  // Content config
  const gc = entities.content.find((c) => c.id === "guide_html");
  const courseCount = gc?.courses || 0;
  const eventCount = gc?.events || 0;
  const blogCount = gc?.blogs || 0;
  const articleTopics = gc?.article_topics || [];

  // Extract org name and date range from entities
  const orgName = entities.orgs?.[0]?.name || domain;
  const allDates = (entities.scenarios || [])
    .flatMap((s) => (s.snapshots || []).map((snap) => snap.date))
    .sort();
  const startYear = allDates.length
    ? new Date(allDates[0]).getFullYear()
    : null;
  const endYear = allDates.length
    ? new Date(allDates.at(-1)).getFullYear()
    : null;

  // Assign cross-links deterministically
  const linked = assignLinks({
    drugs,
    platforms,
    projects: entities.projects,
    people: entities.people,
    teams: entities.teams,
    departments: entities.departments,
    domain,
    courseCount,
    eventCount,
    blogCount,
    articleTopics,
    seed: entities.activity?.seed || 42,
    orgName,
    startYear,
    endYear,
    blogTopics: gc?.blog_topics || null,
  });

  // Enrich platform and drug entities with reverse links
  const enrichedPlatforms = enrichPlatformsWithLinks(linked);
  const enrichedDrugs = enrichDrugsWithLinks(linked);

  // --- Structural pages (unchanged) ---
  const leadershipBody = templates.render("leadership.html", {
    managers: entities.people
      .filter((p) => p.is_manager)
      .map((m) => {
        const team = entities.teams.find((t) => t.id === m.team_id);
        const dept = team
          ? entities.departments.find((d) => d.id === team.department)
          : null;
        return {
          ...m,
          teamName: team?.name || "",
          departmentIri: dept?.iri || "",
        };
      }),
  });
  files.set(
    "organization-leadership.html",
    page(templates, "Organization Leadership", leadershipBody, domain),
  );

  const deptBody = templates.render("departments.html", {
    departments: entities.departments.map((d) => ({
      ...d,
      teams: entities.teams
        .filter((t) => t.department === d.id)
        .map((t) => ({
          ...t,
          members: entities.people
            .filter((p) => p.team_id === t.id)
            .map((p) => ({
              iri: p.iri,
              name: p.name,
              jobTitle: `${p.level} ${p.discipline ? titleCase(p.discipline) : "Engineer"}`,
              teamIri: t.iri,
            })),
        })),
    })),
  });
  files.set(
    "organization-departments-teams.html",
    page(templates, "Organization Departments & Teams", deptBody, domain),
  );

  const rolesBody = templates.render("roles.html", {
    domain: `https://${domain}`,
    levels: ["L1", "L2", "L3", "L4", "L5"].map((id) => ({
      id,
      count: entities.people.filter((p) => p.level === id).length,
    })),
  });
  files.set(
    "roles.html",
    page(templates, "Engineering Roles", rolesBody, domain),
  );

  // --- New linked document types ---

  // Projects cross-functional
  files.set(
    "projects-cross-functional.html",
    page(
      templates,
      "Cross-Functional Projects",
      templates.render("projects.html", { projects: linked.projects }),
      domain,
    ),
  );

  // Technology platforms dependencies
  files.set(
    "technology-platforms-dependencies.html",
    page(
      templates,
      "Technology Platforms",
      templates.render("platforms.html", { platforms: enrichedPlatforms }),
      domain,
    ),
  );

  // Drugs development pipeline
  files.set(
    "drugs-development-pipeline.html",
    page(
      templates,
      "Drug Development Pipeline",
      templates.render("drugs.html", { drugs: enrichedDrugs }),
      domain,
    ),
  );

  // --- Content-driven pages ---
  if (gc) {
    for (const article of linked.articles || []) {
      const body = templates.render("article.html", {
        articles: [
          {
            ...article,
            prose:
              prose.get(`article_${article.topic}`) ||
              `Article about ${article.topic.replace(/_/g, " ")}.`,
          },
        ],
      });
      files.set(
        `articles-${article.topic.replace(/_/g, "-")}.html`,
        page(templates, `${article.title} - Article`, body, domain),
      );
    }

    // Blog posts — individual files + index with blog collection wrapper
    const blogIri = `https://${domain}/id/blog`;
    const blogPosts = linked.blogPosts.map((post) => ({
      ...post,
      blogIri,
      body:
        prose.get(`blog_${post.index - 1}`) ||
        `Blog post about ${post.headline.toLowerCase()}.`,
    }));

    // Individual blog post files
    for (const post of blogPosts) {
      files.set(
        `blog-${post.index}.html`,
        page(
          templates,
          post.headline,
          templates.render("blog-post.html", post),
          domain,
        ),
      );
    }

    // Blog index page
    files.set(
      "blog-posts.html",
      page(
        templates,
        "Engineering Blog",
        templates.render("blog.html", { blogIri, posts: blogPosts }),
        domain,
      ),
    );

    files.set(
      "faq-pages.html",
      page(
        templates,
        "Frequently Asked Questions",
        templates.render("faq.html", {
          faqs: Array.from({ length: gc.faqs || 0 }, (_, i) => {
            const entityPool = [
              ...linked.drugs,
              ...linked.platforms,
              ...linked.projects,
            ];
            const aboutLinks = [
              entityPool[i % entityPool.length],
              entityPool[(i + 3) % entityPool.length],
            ].filter(Boolean);
            return {
              iri: `https://${domain}/id/faq/faq-${i + 1}`,
              question: FAQ_QUESTIONS[i % FAQ_QUESTIONS.length],
              answer: prose.get(`faq_${i}`) || `Answer to FAQ ${i + 1}.`,
              aboutLinks,
            };
          }),
        }),
        domain,
      ),
    );

    for (const topic of gc.howto_topics || []) {
      const body = templates.render("howto.html", {
        domain: `https://${domain}`,
        topic,
        title: titleCase(topic),
        prose:
          prose.get(`howto_${topic}`) ||
          `How-to guide for ${topic.replace(/_/g, " ")}.`,
      });
      files.set(
        `howto-${topic.replace(/_/g, "-")}.html`,
        page(templates, `How-To: ${titleCase(topic)}`, body, domain),
      );
    }

    files.set(
      "reviews.html",
      page(
        templates,
        "Reviews",
        templates.render("reviews.html", {
          reviews: Array.from({ length: gc.reviews || 0 }, (_, i) => {
            const person = entities.people[i % entities.people.length];
            const reviewPool = [
              ...linked.courses,
              ...linked.events,
              ...linked.platforms,
            ];
            const reviewed = reviewPool[i % reviewPool.length];
            return {
              iri: `https://${domain}/id/review/review-${i + 1}`,
              rating: 1 + ((i * 7 + 3) % 5),
              author: person?.name || "Anonymous",
              authorIri: person?.iri || "",
              body:
                prose.get(`review_${i}`) || "Good work on this implementation.",
              reviewedIri: reviewed?.iri || "",
            };
          }),
        }),
        domain,
      ),
    );

    files.set(
      "comments.html",
      page(
        templates,
        "Discussion Comments",
        templates.render("comments.html", {
          comments: Array.from({ length: gc.comments || 0 }, (_, i) => {
            const person = entities.people[i % entities.people.length];
            const parentPool = [
              ...linked.blogPosts,
              ...(linked.articles || []),
            ];
            const parent = parentPool[i % parentPool.length];
            return {
              iri: `https://${domain}/id/comment/comment-${i + 1}`,
              author: person?.name || "Anonymous",
              authorIri: person?.iri || "",
              body:
                prose.get(`comment_${i}`) || "Interesting discussion point.",
              date: `2025-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}`,
              aboutIri: parent?.iri || "",
            };
          }),
        }),
        domain,
      ),
    );

    // Courses — enriched with IDs, prereqs, attendees, platform/drug links
    files.set(
      "courses-learning-catalog.html",
      page(
        templates,
        "Learning Catalog",
        templates.render("courses.html", { courses: linked.courses }),
        domain,
      ),
    );

    // Events — enriched with organizer, attendees, about links
    files.set(
      "events-program-calendar.html",
      page(
        templates,
        "Event Calendar",
        templates.render("events.html", { events: linked.events }),
        domain,
      ),
    );
  }

  return { files, linked };
}

/**
 * Enrich platforms with reverse links from projects and drugs.
 * @param {import('./link-assigner.js').LinkedEntities} linked
 * @returns {object[]}
 */
function enrichPlatformsWithLinks(linked) {
  return linked.platforms.map((plat) => {
    // Resolve dependency objects for template rendering
    const depObjects = (plat.dependencies || [])
      .map((depId) => linked.platforms.find((p) => p.id === depId))
      .filter(Boolean);

    // Reverse: projects that link to this platform
    const projectLinks = linked.projects
      .filter((proj) => proj.platformLinks.some((pl) => pl.id === plat.id))
      .slice(0, 3);

    // Reverse: drugs that use this platform
    const drugLinks = linked.drugs
      .filter(
        (d) =>
          d.platformLinks && d.platformLinks.some((pl) => pl.id === plat.id),
      )
      .slice(0, 2);

    return {
      ...plat,
      dependencies: depObjects,
      projectLinks,
      drugLinks,
    };
  });
}

/**
 * Enrich drugs with reverse links from projects, platforms, events.
 * @param {import('./link-assigner.js').LinkedEntities} linked
 * @returns {object[]}
 */
function enrichDrugsWithLinks(linked) {
  const base = linked.drugs[0]?.iri?.replace(/\/id\/drug\/.*/, "") || "";

  return linked.drugs.map((drug) => {
    // Reverse: projects that reference this drug
    const projectLinks = linked.projects
      .filter((proj) => proj.drugLinks.some((dl) => dl.id === drug.id))
      .slice(0, 3);

    // Platforms associated via projects
    const platformIds = new Set();
    for (const proj of projectLinks) {
      for (const pl of proj.platformLinks) platformIds.add(pl.id);
    }
    const platformLinks = linked.platforms
      .filter((p) => platformIds.has(p.id))
      .slice(0, 3);

    // Events about this drug
    const eventLinks = linked.events
      .filter((e) => e.aboutDrugs.some((d) => d.id === drug.id))
      .slice(0, 2);

    const parentDrugIri = drug.parentDrug
      ? `${base}/id/drug/${drug.parentDrug}`
      : null;

    return {
      ...drug,
      projectLinks,
      platformLinks,
      eventLinks,
      parentDrugIri,
    };
  });
}

/**
 * Render organization README.
 * @param {object} entities
 * @param {Map<string,string>} prose
 * @param {import('@forwardimpact/libtemplate/loader').TemplateLoader} templates - Template loader
 * @returns {string}
 */
export function renderREADME(entities, prose, templates) {
  if (!templates) throw new Error("templates is required");
  const orgName = entities.orgs[0]?.name || "Organization";
  return templates.render("readme.md", {
    orgName,
    overview:
      prose.get("org_readme") || `${orgName} is a pharmaceutical company.`,
    departments: entities.departments.map((d) => ({
      ...d,
      teams: entities.teams.filter((t) => t.department === d.id),
    })),
    projects: entities.projects.map((p) => ({
      ...p,
      prose: prose.get(`project_${p.id}`) || p.prose_topic || "",
    })),
  });
}

/**
 * Render ONTOLOGY.md with entity IRIs.
 * @param {object} entities
 * @param {import('@forwardimpact/libtemplate/loader').TemplateLoader} templates - Template loader
 * @returns {string}
 */
export function renderONTOLOGY(entities, templates) {
  if (!templates) throw new Error("templates is required");
  const people = entities.people.slice(0, 30);
  return templates.render("ontology.md", {
    domain: entities.domain,
    orgs: entities.orgs,
    departments: entities.departments,
    teams: entities.teams,
    people,
    hasMore: entities.people.length > 30,
    moreCount: entities.people.length - 30,
    projects: entities.projects,
  });
}
