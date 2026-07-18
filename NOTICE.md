# Third-Party Notices

bynku is built on top of open-source software. This document lists the
third-party packages we depend on, their licenses, and the copyright notices
of their authors. We are grateful to every maintainer and contributor whose
work makes this app possible.

The bynku application code itself is proprietary and is **not** covered by
the licenses below. The licenses below apply only to the corresponding
third-party packages when redistributed or used as libraries.

For the authoritative, machine-readable list of installed packages and their
exact versions, see [`package.json`](./package.json) and the lockfile in this
repository. Each package's own `LICENSE` file (available inside its
`node_modules/<package>/` directory) is the definitive source for its license
text.

---

## Framework, runtime, and build

| Package                             | License    | Copyright                                            |
| ----------------------------------- | ---------- | ---------------------------------------------------- |
| react, react-dom                    | MIT        | © Meta Platforms, Inc. and affiliates                |
| @tanstack/react-router              | MIT        | © Tanner Linsley                                     |
| @tanstack/react-start               | MIT        | © Tanner Linsley                                     |
| @tanstack/router-plugin             | MIT        | © Tanner Linsley                                     |
| @tanstack/react-query               | MIT        | © Tanner Linsley                                     |
| vite                                | MIT        | © Yuxi (Evan) You and Vite contributors              |
| @vitejs/plugin-react                | MIT        | © Vite contributors                                  |
| vite-tsconfig-paths                 | MIT        | © Aleclarson                                         |
| nitro                               | MIT        | © Pooya Parsa and UnJS contributors                  |
| typescript                          | Apache-2.0 | © Microsoft Corporation                              |
| zod                                 | MIT        | © Colin McDonnell                                    |

## UI, styling, and design system

| Package                                        | License | Copyright                                    |
| ---------------------------------------------- | ------- | -------------------------------------------- |
| tailwindcss, @tailwindcss/vite                 | MIT     | © Tailwind Labs, Inc.                        |
| tw-animate-css                                 | MIT     | © tw-animate-css contributors                |
| @radix-ui/react-\* (all Radix primitives)      | MIT     | © WorkOS, Inc. (Radix UI)                    |
| lucide-react                                   | ISC     | © Lucide Contributors                        |
| class-variance-authority                       | Apache-2.0 | © Joe Bell                                |
| clsx                                           | MIT     | © Luke Edwards                               |
| tailwind-merge                                 | MIT     | © Dany Castillo                              |
| cmdk                                           | MIT     | © Paco Coursey                               |
| sonner                                         | MIT     | © Emil Kowalski                              |
| vaul                                           | MIT     | © Emil Kowalski                              |
| embla-carousel-react                           | MIT     | © David Jerleke                              |
| react-resizable-panels                         | MIT     | © Brian Vaughn                               |
| input-otp                                      | MIT     | © Guilherme Rodz                             |
| react-day-picker                               | MIT     | © Giampaolo Bellavite                        |
| recharts                                       | MIT     | © Recharts Group                             |
| react-markdown                                 | MIT     | © Titus Wormer                               |
| react-hook-form                                | MIT     | © Beier (Bill) Luo                           |
| @hookform/resolvers                            | MIT     | © Bill Luo                                   |

## Backend, AI, and email

| Package                          | License    | Copyright                                        |
| -------------------------------- | ---------- | ------------------------------------------------ |
| @supabase/supabase-js            | MIT        | © Supabase, Inc.                                 |
| ai (Vercel AI SDK)               | Apache-2.0 | © Vercel, Inc.                                   |
| @ai-sdk/openai-compatible        | Apache-2.0 | © Vercel, Inc.                                   |
| @react-email/components          | MIT        | © Resend, Inc.                                   |
| @react-email/render              | MIT        | © Resend, Inc.                                   |
| @lovable.dev/cloud-auth-js       | MIT        | © Lovable                                        |
| @lovable.dev/email-js            | MIT        | © Lovable                                        |
| @lovable.dev/webhooks-js         | MIT        | © Lovable                                        |
| @lovable.dev/vite-tanstack-config| MIT        | © Lovable                                        |

## Utilities

| Package     | License | Copyright                                |
| ----------- | ------- | ---------------------------------------- |
| date-fns    | MIT     | © Sasha Koss and Lesha Koss              |

## Dev tooling

| Package                        | License | Copyright                                    |
| ------------------------------ | ------- | -------------------------------------------- |
| eslint, @eslint/js             | MIT     | © OpenJS Foundation and ESLint contributors  |
| typescript-eslint              | MIT     | © typescript-eslint contributors             |
| eslint-plugin-react-hooks      | MIT     | © Meta Platforms, Inc. and affiliates        |
| eslint-plugin-react-refresh    | MIT     | © Arnaud Barré                               |
| eslint-config-prettier         | MIT     | © Simon Lydell and contributors              |
| eslint-plugin-prettier         | MIT     | © Andres Suarez and Teddy Katz               |
| prettier                       | MIT     | © James Long and contributors                |
| globals                        | MIT     | © Sindre Sorhus                              |
| @types/node, @types/react, @types/react-dom, @types/bun | MIT | © DefinitelyTyped contributors |

## Data sources

- **Eurostat** — household income deciles and expenditure shares used in the
  Benchmarks feature (`src/lib/benchmarks/*.json`). Eurostat data is
  redistributed under the free-reuse policy stated at
  <https://ec.europa.eu/eurostat/about-us/policies/copyright> with attribution.

## Fonts and icons

- **Lucide** icon set — ISC License, © Lucide Contributors.
- The bynku wordmark, logo, and app icon are © bynku and are **not** covered
  by the licenses above.

---

## License texts

Most dependencies above use the **MIT License**, the **ISC License**, or the
**Apache License 2.0**. The canonical texts of these licenses are reproduced
below for convenience.

### MIT License

```
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

### ISC License

```
Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
```

### Apache License 2.0

The full text of the Apache License 2.0 is available at
<https://www.apache.org/licenses/LICENSE-2.0>.

Packages distributed under Apache-2.0 in this project include: `typescript`,
`class-variance-authority`, `ai`, and `@ai-sdk/openai-compatible`. Their
`NOTICE` files (where present in their published packages) are included by
reference.

---

## Reporting issues

If you are an author of a package listed here and find your attribution
missing or incorrect, please open an issue or contact us at
<https://bynku.app> so we can correct it.
