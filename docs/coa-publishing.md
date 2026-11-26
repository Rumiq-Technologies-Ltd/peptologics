# Publishing Certificates of Analysis

How a laboratory report becomes a public record on the site. The data model is in
[database.md](./database.md#coa-reports). The public site only reads; **everything here is done by
a person running one script**.

## What you need

- The laboratory's own report (PDF or image) and its **report ID** exactly as printed.
- Node (the same as the app) and, for a table, AWS credentials. Locally `.env.local` sets
  `AWS_PROFILE`; see [deployment.md](./deployment.md).
- Never run this against a production table yourself. The control chat does that, with
  `--allow-prod`.

## Steps

1. **Put the files in the repo**, under `public/coa/<REPORT_ID>/`: the lab's report as
   `report.webp` (or `.jpg`, `.png`) and any chromatograms. Lower-case file names, no spaces.
2. **Write the manifest** at `data/coa/<REPORT_ID>.json`. Copy `data/coa/fixtures/TEST-0001.json`
   and replace every value **from the lab's report**. Nothing is computed; type what the lab
   printed. Find a product's id with:

   ```bash
   npm run coa -- products --table peptologics-dev
   ```

3. **Open a pull request into `staging`** with the files and the manifest. The pull request is the
   review: a second person compares the manifest with the lab's report.
4. **After it has deployed, dry-run.** This reads the table and prints exactly what it would
   write, laid out to compare against the lab report. It writes nothing:

   ```bash
   npm run coa -- publish data/coa/<REPORT_ID>.json --table peptologics-staging
   ```

5. **Apply** the same command with `--apply`. Add `--revalidate-url https://<site>` (and
   `REVALIDATE_SECRET` in the environment) to refresh the site's cached pages straight away.

Files go first and data second, on purpose: the script refuses if a referenced file is not on
disk, so a record can never point at an image that is not deployed.

## What the script refuses

| Situation                                                       | Why                                                                     |
| --------------------------------------------------------------- | ----------------------------------------------------------------------- |
| A peptide report with no measured purity, or one below 99%      | The company rule (D18). Raise it with the owner; do not work around it. |
| A `product_id` that is not in the table                         | The record would hang off nothing.                                      |
| An amendment with no `change_note`                              | A change to a published report is public, so its reason is too.         |
| A changed lot number or laboratory on a published report        | Those identify the report. Withdraw it and publish a new one.           |
| A superseded report whose replacement is not published          | The banner would link nowhere.                                          |
| A report ID starting `TEST-` on a table that is not a dev table | Test fixtures are fake.                                                 |
| A table with `prod` in its name, without `--allow-prod`         | Production is not run from a developer machine.                         |

A purity below 99% blocks only an **active** report. Withdrawing or superseding is always
possible.

## Amending, withdrawing, superseding

Versions are immutable: each of these writes a **new version** and the old one stays in the
public revision history.

```bash
# Edit the manifest, add a change_note, then publish again: this becomes the next version.
npm run coa -- publish data/coa/<REPORT_ID>.json --table <table> --apply

# Pull a report. The record page stays up with a banner and the reason.
npm run coa -- withdraw <REPORT_ID> --reason "Issued in error." --table <table> --apply

# Replace it with another published report (for example, a new lot).
npm run coa -- supersede <REPORT_ID> --by <NEW_REPORT_ID> --reason "Replaced by the 1000 mg lot." --table <table> --apply
```

Running the same publish command twice is safe: when the manifest matches the latest version
the script says so and writes nothing.

## Development fixtures

`data/coa/fixtures/TEST-000*.json` are fake reports for local testing, with placeholder images
under `public/coa/TEST-000*/`. They are written to `peptologics-dev` only; the script refuses
them anywhere else. They exist so the record pages have something to show:

- `TEST-0001`: BPC-157, with a chromatogram.
- `TEST-0002`: NAD+ tested at 500 mg but attached to the 1000 mg product (the "previous lot" case).
- `TEST-0003`: demonstrates withdrawal (publish it, then `withdraw` it).

The placeholder images are inert outside a table that holds these records.

## How the script runs

`npm run coa` is plain Node (which runs TypeScript natively) with `scripts/register-aliases.mjs`
loaded, so the script imports the app's own schema and rules by their `@/` alias instead of
keeping a second copy. Only modules free of `server-only`, React and `@/lib/env` can be shared
this way.
