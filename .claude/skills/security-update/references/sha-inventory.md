# GitHub Actions SHA Inventory

When evaluating SHA pinning (Policy Check 2), verify the PR updates **all**
workflow files that reference the action.

| Action                          | Workflow files                                                                                                              |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `actions/checkout`              | check-quality.yml, check-test.yml, check-security.yml, publish-npm.yml, publish-macos.yml, publish-skills.yml, website.yaml |
| `actions/setup-node`            | check-quality.yml, check-test.yml, check-security.yml, publish-npm.yml, website.yaml                                        |
| `actions/configure-pages`       | website.yaml                                                                                                                |
| `actions/upload-pages-artifact` | website.yaml                                                                                                                |
| `actions/deploy-pages`          | website.yaml                                                                                                                |
| `denoland/setup-deno`           | publish-macos.yml                                                                                                           |
