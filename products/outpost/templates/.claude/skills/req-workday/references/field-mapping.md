# Field Mapping

Reference for `req-workday` Step 5. Map Workday columns to candidate brief
fields.

## Core columns

| Header                 | Maps to brief field…                              |
| ---------------------- | ------------------------------------------------- |
| Job Application        | `# {Name}`                                        |
| Stage                  | Row detection only (not used for status)          |
| Step / Disposition     | **Workday step** → status (see status-mapping.md) |
| Resume                 | Reference only (no file)                          |
| Date Applied           | **First seen**                                    |
| Current Job Title      | **Current title**, Title                          |
| Current Company        | **Current title** suffix                          |
| Source                 | **Source**                                        |
| Referred by            | **Source** suffix                                 |
| Candidate Location     | **Location**                                      |
| Phone                  | **Phone**                                         |
| Email                  | **Email**                                         |
| Availability Date      | **Availability**                                  |
| Visa Requirement       | Notes                                             |
| Eligible to Work       | Notes                                             |
| Relocation             | Notes                                             |
| Salary Expectations    | **Rate**                                          |
| Non-Compete            | Notes                                             |
| Total Years Experience | Summary context                                   |
| All Job Titles         | Work History context                              |
| Companies              | Work History context                              |
| Degrees                | Education                                         |
| Fields of Study        | Education                                         |
| Language               | **English** / Language                            |
| Resume Text            | `CV.md` content                                   |

## Extra info field order

After `Last activity`, in this order, only when known: `Req`,
`Internal/External`, `Current title`, `Email`, `Phone`, `LinkedIn`. Follow the
same order as `req-track`.
