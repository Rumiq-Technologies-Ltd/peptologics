# Certificates of Analysis: the COA library and "Verify with lab"

Open **Lab testing** (`/lab-testing`) and press **View COA** on a product. A dialog shows the
laboratory, the lot and the purity as the lab states them, the lab's **code** with a **Copy code**
button, and a **Verify with lab** button that opens the lab's own record in a new tab.

The site publishes a copy (or only a pointer); the laboratory's own record is the authority. Nothing
here claims an accreditation (neither laboratory is ISO/IEC 17025 accredited), and a test fails the
build if the words appear.

## One source of truth

`src/features/coa/constants/coaReports.ts` is the **only** place that says which products have a COA.
It is keyed by **product slug**. `products.coa_url` in the database is **unused**: the migration
`20261127120000_coa_config_and_slug_rename.sql` clears it on every row, the repositories and mapper no
longer read it, `/lab-testing` is built from the catalog plus this file, and the DynamoDB `coa_url`
attribute is no longer read or written (any leftover attribute on a staging or prod item is ignored
and can be removed). The Supabase column stays until Supabase is retired.

| What                             | File                                              |
| -------------------------------- | ------------------------------------------------- |
| The laboratories and their URL   | `src/features/coa/constants/labs.ts`              |
| Every COA (lab, code, lot, file) | `src/features/coa/constants/coaReports.ts`        |
| The facts strip and Verify link  | `src/features/coa/components/CoaFacts.tsx`        |
| The library and dialog           | `src/features/products/components/CoaLibrary.tsx` |

## One dialog that adapts to each report

Every COA opens the same dialog. What shows is derived from the entry in `coaReports.ts`; there is
no per-product code.

| COA type             | Header button   | Body                                          |
| -------------------- | --------------- | --------------------------------------------- |
| Hosted scan          | Verify with lab | facts, then the scan, then Open full size     |
| Hosted PDF           | Verify with lab | facts, then Open PDF (+ Previous certificate) |
| Link-only, one lab   | Verify with lab | facts only                                    |
| Link-only, two labs  | none            | one facts strip per lab, each with Verify     |
| Other-company report | none            | the scan, no Verify                           |

- The **facts strip** (lab, its warning, lot, purity, code with **Copy code**, one-line instruction)
  always sits above any scan.
- **Verify with lab** sits top right beside the close button when the current view has exactly one
  verifiable report, so it never scrolls out of sight. On a phone it shows as a shield and "Verify".
  The "Previous certificate" view counts as its own view with its own lab.
- Axiom opens `https://axiomanalyticslab.com/verify?coa=<id>` (the ID URL-encoded). Bioviridian has no
  per-report link, so it opens its COA search page and the customer pastes the code there.
- PL3 and PL2 are link-only: no scan, image or PDF is shown or stored.

## "Previous certificate"

Only a product whose COA files are **all hosted on this site** and that has COAs from **both labs**
gets it (today IPA 10 mg and Tesamorelin 20 mg). Link-only products never do, even PL3 30 mg with
reports from two labs. `getPreviousReport()` enforces this; a unit test covers it. The older report is
labelled with its own lot ("Previous certificate · 10 mg lot" for Tesamorelin).

## Adding or replacing a certificate

1. Put the file (if hosted) in `public/coa/`, named for the lab's report ID.
2. Add or edit the product's entry in `coaReports.ts`, with the code **exactly as the lab prints it**.
3. Open it on `/lab-testing` and check the dialog. A unit test confirms every hosted file exists.

## Reports we do not verify

The SS-31 (PL-31SS) and NAD+ 500 mg scans are reports issued to other companies. They stay as they
are today, by owner decision (pending the owner's boss), with no lab and no Verify button.

## Adding a laboratory

Add it to `CoaLabId` and `COA_LABS` in `labs.ts` with its verification page and a `verifyUrl`. If the
lab has no stable per-report link, point `verifyUrl` at its search page rather than guessing one.
