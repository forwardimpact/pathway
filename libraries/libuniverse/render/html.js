/**
 * HTML Renderer — generates HTML microdata files for Guide.
 *
 * Uses libformat's createHtmlFormatter for sanitizing LLM prose.
 */

/**
 * Render HTML microdata files from entities and prose.
 * @param {object} entities
 * @param {Map<string,string>} prose
 * @returns {Map<string,string>} filename → HTML content
 */
export function renderHTML(entities, prose) {
  const files = new Map()
  const domain = `https://${entities.domain}`

  files.set('organization-leadership.html', renderLeadership(entities, domain))
  files.set('organization-departments-teams.html', renderDepartments(entities, domain))
  files.set('roles.html', renderRoles(entities, domain))

  // Articles
  const guideContent = entities.content.find(c => c.id === 'guide_html')
  if (guideContent) {
    for (const topic of (guideContent.article_topics || [])) {
      const proseContent = prose.get(`article_${topic}`) || `Article about ${topic.replace(/_/g, ' ')}.`
      files.set(`articles-${topic.replace(/_/g, '-')}.html`,
        renderArticle(topic, entities, proseContent, domain))
    }

    // Blog posts
    files.set('blog-posts.html', renderBlogPosts(entities, prose, guideContent, domain))

    // FAQs
    files.set('faq-pages.html', renderFAQs(entities, prose, guideContent, domain))

    // HowTos
    for (const topic of (guideContent.howto_topics || [])) {
      const proseContent = prose.get(`howto_${topic}`) || `How-to guide for ${topic.replace(/_/g, ' ')}.`
      files.set(`howto-${topic.replace(/_/g, '-')}.html`,
        renderHowTo(topic, proseContent, domain))
    }

    // Reviews
    files.set('reviews.html', renderReviews(entities, prose, guideContent, domain))

    // Comments
    files.set('comments.html', renderComments(entities, prose, guideContent, domain))

    // Courses
    files.set('courses-learning-catalog.html', renderCourses(entities, guideContent, domain))

    // Events
    files.set('events-program-calendar.html', renderEvents(entities, guideContent, domain))
  }

  return files
}

/**
 * Render organization README.
 * @param {object} entities
 * @param {Map<string,string>} prose
 * @returns {string}
 */
export function renderREADME(entities, prose) {
  const orgName = entities.orgs[0]?.name || 'BioNova'
  const overview = prose.get('org_readme') || `${orgName} is a pharmaceutical company.`

  const lines = [`# ${orgName}\n`, overview, '\n## Departments\n']

  for (const dept of entities.departments) {
    lines.push(`### ${dept.name}\n`)
    const deptTeams = entities.teams.filter(t => t.department === dept.id)
    for (const team of deptTeams) {
      lines.push(`- **${team.name}** (${team.size} members)`)
    }
    lines.push('')
  }

  lines.push('## Projects\n')
  for (const proj of entities.projects) {
    const projProse = prose.get(`project_${proj.id}`) || proj.prose_topic || ''
    lines.push(`### ${proj.name}\n`)
    lines.push(`- Type: ${proj.type}`)
    lines.push(`- Timeline: ${proj.timeline_start} to ${proj.timeline_end}`)
    if (projProse) lines.push(`\n${projProse}`)
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Render ONTOLOGY.md with entity IRIs.
 * @param {object} entities
 * @returns {string}
 */
export function renderONTOLOGY(entities) {
  const lines = ['# Entity Ontology\n',
    `Domain: \`https://${entities.domain}\`\n`,
    '## Organizations\n']

  for (const org of entities.orgs) {
    lines.push(`- [${org.name}](${org.iri})`)
  }

  lines.push('\n## Departments\n')
  for (const dept of entities.departments) {
    lines.push(`- [${dept.name}](${dept.iri})`)
  }

  lines.push('\n## Teams\n')
  for (const team of entities.teams) {
    lines.push(`- [${team.name}](${team.iri})`)
  }

  lines.push('\n## People\n')
  for (const person of entities.people.slice(0, 30)) {
    lines.push(`- [${person.name}](${person.iri}) — ${person.discipline} ${person.level}`)
  }
  if (entities.people.length > 30) {
    lines.push(`- ... and ${entities.people.length - 30} more`)
  }

  lines.push('\n## Projects\n')
  for (const proj of entities.projects) {
    lines.push(`- [${proj.name}](${proj.iri})`)
  }

  return lines.join('\n')
}

// ─── Internal renderers ──────────────────────────

function renderLeadership(entities, domain) {
  const managers = entities.people.filter(p => p.is_manager)
  const items = managers.map(m => {
    const team = entities.teams.find(t => t.id === m.team_id)
    return `  <div itemscope itemtype="https://schema.org/Person" itemid="${m.iri}">
    <span itemprop="name">${escapeHtml(m.name)}</span>
    <span itemprop="jobTitle">Manager, ${escapeHtml(team?.name || '')}</span>
    <span itemprop="email">${escapeHtml(m.email)}</span>
  </div>`
  }).join('\n')

  return wrapHtml('Organization Leadership', items, domain)
}

function renderDepartments(entities, domain) {
  const sections = entities.departments.map(dept => {
    const teams = entities.teams.filter(t => t.department === dept.id)
    const teamItems = teams.map(t =>
      `    <div itemscope itemtype="https://schema.org/Organization" itemid="${t.iri}">
      <span itemprop="name">${escapeHtml(t.name)}</span>
      <meta itemprop="numberOfEmployees" content="${t.size}">
    </div>`
    ).join('\n')

    return `  <div itemscope itemtype="https://schema.org/Organization" itemid="${dept.iri}">
    <span itemprop="name">${escapeHtml(dept.name)}</span>
    <div itemprop="department">
${teamItems}
    </div>
  </div>`
  }).join('\n')

  return wrapHtml('Organization Departments & Teams', sections, domain)
}

function renderRoles(entities, domain) {
  const levels = ['L1', 'L2', 'L3', 'L4', 'L5']
  const items = levels.map(level => {
    const count = entities.people.filter(p => p.level === level).length
    return `  <div itemscope itemtype="https://schema.org/Role" itemid="${domain}/role/${level}">
    <span itemprop="name">${level}</span>
    <meta itemprop="occupationalCategory" content="Engineering">
    <span>${count} people at this level</span>
  </div>`
  }).join('\n')

  return wrapHtml('Engineering Roles', items, domain)
}

function renderArticle(topic, entities, prose, domain) {
  const title = topic.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  return wrapHtml(`${title} - Article`, `  <article itemscope itemtype="https://schema.org/Article" itemid="${domain}/article/${topic}">
    <h2 itemprop="headline">${escapeHtml(title)}</h2>
    <div itemprop="articleBody">
      <p>${escapeHtml(prose)}</p>
    </div>
    <span itemprop="author">${escapeHtml(entities.orgs[0]?.name || 'BioNova')}</span>
  </article>`, domain)
}

function renderBlogPosts(entities, prose, content, domain) {
  const count = content.blogs || 0
  const items = []
  for (let i = 0; i < count; i++) {
    const body = prose.get(`blog_${i}`) || `Blog post ${i + 1} about pharmaceutical engineering.`
    items.push(`  <article itemscope itemtype="https://schema.org/BlogPosting" itemid="${domain}/blog/${i + 1}">
    <h2 itemprop="headline">Engineering Blog Post ${i + 1}</h2>
    <div itemprop="articleBody"><p>${escapeHtml(body)}</p></div>
    <time itemprop="datePublished">2025-${String(Math.floor(i / 2) + 1).padStart(2, '0')}-15</time>
  </article>`)
  }
  return wrapHtml('Engineering Blog', items.join('\n'), domain)
}

function renderFAQs(entities, prose, content, domain) {
  const count = content.faqs || 0
  const items = []
  for (let i = 0; i < count; i++) {
    const answer = prose.get(`faq_${i}`) || `Answer to FAQ ${i + 1}.`
    items.push(`  <div itemscope itemtype="https://schema.org/Question" itemid="${domain}/faq/${i + 1}">
    <span itemprop="name">FAQ Question ${i + 1}</span>
    <div itemscope itemtype="https://schema.org/Answer" itemprop="acceptedAnswer">
      <span itemprop="text">${escapeHtml(answer)}</span>
    </div>
  </div>`)
  }
  return wrapHtml('Frequently Asked Questions', items.join('\n'), domain)
}

function renderHowTo(topic, prose, domain) {
  const title = topic.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  return wrapHtml(`How-To: ${title}`, `  <div itemscope itemtype="https://schema.org/HowTo" itemid="${domain}/howto/${topic}">
    <h2 itemprop="name">${escapeHtml(title)}</h2>
    <div itemprop="text"><p>${escapeHtml(prose)}</p></div>
  </div>`, domain)
}

function renderReviews(entities, prose, content, domain) {
  const count = content.reviews || 0
  const items = []
  for (let i = 0; i < count; i++) {
    const body = prose.get(`review_${i}`) || 'Good work on this implementation.'
    const reviewer = entities.people[i % entities.people.length]
    items.push(`  <div itemscope itemtype="https://schema.org/Review" itemid="${domain}/review/${i + 1}">
    <span itemprop="author">${escapeHtml(reviewer?.name || 'Anonymous')}</span>
    <span itemprop="reviewBody">${escapeHtml(body)}</span>
    <meta itemprop="reviewRating" content="${3 + (i % 3)}">
  </div>`)
  }
  return wrapHtml('Reviews', items.join('\n'), domain)
}

function renderComments(entities, prose, content, domain) {
  const count = content.comments || 0
  const items = []
  for (let i = 0; i < count; i++) {
    const body = prose.get(`comment_${i}`) || 'Interesting discussion point.'
    const author = entities.people[i % entities.people.length]
    items.push(`  <div itemscope itemtype="https://schema.org/Comment" itemid="${domain}/comment/${i + 1}">
    <span itemprop="author">${escapeHtml(author?.name || 'Anonymous')}</span>
    <span itemprop="text">${escapeHtml(body)}</span>
  </div>`)
  }
  return wrapHtml('Discussion Comments', items.join('\n'), domain)
}

function renderCourses(entities, content, domain) {
  const count = content.courses || 0
  const items = []
  const courseTopics = [
    'Introduction to Drug Discovery', 'Clinical Data Management',
    'GMP Compliance Essentials', 'Pharmaceutical Statistics',
    'Molecular Biology Fundamentals', 'Regulatory Submissions',
    'Data Engineering for Pharma', 'AI in Drug Development',
    'Quality Assurance Methods', 'Supply Chain Management',
    'Cloud Infrastructure Security', 'API Design Patterns',
    'Machine Learning Pipelines', 'DevOps Best Practices',
    'Technical Writing for Scientists',
  ]
  for (let i = 0; i < count; i++) {
    const title = courseTopics[i % courseTopics.length]
    items.push(`  <div itemscope itemtype="https://schema.org/Course" itemid="${domain}/course/${i + 1}">
    <span itemprop="name">${escapeHtml(title)}</span>
    <span itemprop="provider">${escapeHtml(entities.orgs[0]?.name || 'BioNova')}</span>
    <time itemprop="startDate">2025-${String((i % 12) + 1).padStart(2, '0')}-01</time>
  </div>`)
  }
  return wrapHtml('Learning Catalog', items.join('\n'), domain)
}

function renderEvents(entities, content, domain) {
  const count = content.events || 0
  const items = []
  const eventNames = [
    'Engineering All-Hands', 'Tech Talk: AI in Pharma',
    'Hackathon 2025', 'Architecture Review Board',
    'Sprint Demo Day', 'New Hire Orientation',
    'Compliance Training', 'Platform Migration Workshop',
    'Data Science Summit', 'Security Awareness Week',
  ]
  for (let i = 0; i < count; i++) {
    const name = eventNames[i % eventNames.length]
    items.push(`  <div itemscope itemtype="https://schema.org/Event" itemid="${domain}/event/${i + 1}">
    <span itemprop="name">${escapeHtml(name)}</span>
    <span itemprop="organizer">${escapeHtml(entities.orgs[0]?.name || 'BioNova')}</span>
    <time itemprop="startDate">2025-${String((i % 12) + 1).padStart(2, '0')}-15</time>
    <span itemprop="location">${escapeHtml(entities.orgs[0]?.location || 'Cambridge, MA')}</span>
  </div>`)
  }
  return wrapHtml('Event Calendar', items.join('\n'), domain)
}

// ─── Helpers ─────────────────────────────────────

function wrapHtml(title, body, domain) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <base href="${domain}/">
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
${body}
</body>
</html>`
}

function escapeHtml(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
