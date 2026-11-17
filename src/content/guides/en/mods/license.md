---
title: 'Reusing Narsil code: the GPL v3'
description: Both Narsil mods are licensed GPL-3.0-or-later. What that means when you study, change, or share code taken from them.
route: mods
order: 5
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: LICENSE
  - repo: pet
    path: .claude-plugin/plugin.json
  - repo: pet
    path: README.md
  - repo: check
    path: LICENSE
  - repo: check
    path: .claude-plugin/plugin.json
  - repo: check
    path: README.md
---

## What it does

narsil-pet and narsil-check are open source, and the guides on this site quote and adapt their code. This guide explains, in plain terms, what their license lets you do with that code and what it asks of you when you pass it on.

This is not legal advice. It summarizes the license text that ships with both mods. For a decision that matters, read the full license and ask a lawyer.

## How it works inside

Both mods carry the same license:

- `plugin.json` sets `"license": "GPL-3.0-or-later"`.
- The repository's `LICENSE` file is the full text of the GNU General Public License, version 3.
- The README says the mod may be redistributed and modified under the GPL v3 or, at your option, any later version published by the Free Software Foundation.

The license separates two situations:

| Situation                                                              | What the GPL v3 says                                                                                                        |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| You use or change the code without giving copies to anyone             | You may make, run and change it without conditions, as long as your license remains in force (section 2).                   |
| You convey it: give or make copies available to others, changed or not | Conditions apply (sections 4 to 6). Interacting with a program over a network without transferring a copy is not conveying. |

When you convey the code, the main conditions are:

- **Unchanged source (section 4):** keep the copyright and license notices intact, keep the notices that there is no warranty, and give recipients a copy of the license.
- **Modified source (section 5):** the work must carry "prominent notices stating that you modified it", with a relevant date; it must say it is released under this license; and you must license the entire work, as a whole, under the GPL v3 to anyone who gets a copy.
- **Other forms (section 6):** conveying the work in a non-source form requires also conveying its corresponding source.

A mod is distributed as its source files, so in practice sharing a mod built from Narsil code means sharing that source under the GPL v3.

## Step by step

### 1. Decide whether you will share it

If the mod stays on your machine, the conditions for conveying do not apply. Once you publish a repository, send a `.plugin` file or hand the folder to someone, they do.

### 2. Keep the license

Ship the GPL v3 text as a `LICENSE` file and set the license in your manifest:

```json
{
  "name": "my-band",
  "version": "0.1.0",
  "description": "A status band adapted from narsil-pet",
  "license": "GPL-3.0-or-later"
}
```

Keep "or later" only if you keep the option the original gives. Do not replace the license with a more permissive one for the parts that come from Narsil.

### 3. Mark what you took and what you changed

Name the source and the change near the code. A header like this one covers attribution, the link to the repository and the notice of modification:

```ts
// Adapted from narsil-pet (https://github.com/davshn/narsil-pet), hooks/register.tsx.
// Changed 2026-11-17: renamed the band and removed the floating window.
// Licensed under the GNU General Public License, version 3 or later.
```

Keep any notices that were already in the files you copied.

### 4. Make the source available

Publish the full source of the mod you share, not only the files you took from Narsil. The license applies to the whole work.

## Common mistakes and how to test it

- **Shipping without a license file.** `claude plugin validate` reports `LICENSE_MISSING` among the plugin directory checks when there is no `LICENSE` file and no `license` in `plugin.json`. Run it before you share.
- **Relicensing copied code.** Code taken from Narsil cannot be shared under MIT, Apache or a proprietary license.
- **Dropping the attribution.** Removing the link to the original repository or the notice that you changed the code goes against the notice conditions.
- **Sharing only part of the source.** Recipients must be able to get the source of the whole mod.

Before you share, check that your folder has the license text, that `plugin.json` names the license, and that each adapted file says where it came from and what changed.

## Going further

Read the `LICENSE` file in either repository for the full text; sections 2, 4, 5 and 6 are the ones summarized here. The license section at the end of each README gives the project's own short summary: you may use, study, change and share the mod, and a modified version you distribute must also be published as open source under the same license, with no warranty. The guides on this site follow the same practice: every snippet adapted from Narsil names its repository and file, and each guide lists those files under its sources.

Whether a mod you write from scratch, after reading Narsil's code, counts as a work based on it is a legal question this guide does not answer.
