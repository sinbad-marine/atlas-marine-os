# Per-Regulation provenance metadata for the MLC 2006 manifests built by build_manifest.py.
# Every statement below was checked against the authentic amendment texts listed in amendmentSources
# and against the four-stage word diff produced by slice_diff.py (see diffEvidence in each output file).

A2014 = 'ILO_175166_2014_amendments.pdf'          # GB.322/LILS/3 - report of the 1st STC meeting incl. the adopted 2014 amendment text
A2016 = 'ILO_wcms_488452_2016_amendments.pdf'     # ILC 105, Provisional Record 3-1A, Amendments of 2016
A2018 = 'ILO_wcms_632462_2018_amendments.pdf'     # ILC 107, authentic text, Amendments of 2018
A2022 = 'ILO_wcms_848492_2022_amendments.pdf'     # ILC 110, authentic text, Amendments of 2022
A2025 = 'ILO_ILC113_2025_amendments.pdf'          # ILC 113, texts adopted 6 June 2025 (not yet in force)

STD_METHOD = ("No GROK/GEMINI access this session. Method: PRIMARY_SOURCE_FOUR_STAGE_DIFF (see verifiedSources[0].verificationMethod) "
              "over the ILO consolidated 2022 text, the ILO 2014+2016 consolidated text and two 2006-original mirrors, with every "
              "substantive diff span matched to the authentic ILO amendment texts of 2014, 2016, 2018 and 2022. The 2025 amendments "
              "(ILC 113, adopted 6 June 2025, expected entry into force 23 December 2027) are NOT in force and are NOT blended into "
              "fullText; they are recorded in pendingAmendments2025 only. Running headers, page numbers and soft hyphenation were "
              "removed when re-flowing fullText; every hyphen join is listed in diffEvidence.hyphenJoinsApplied for audit.")

UNCHANGED = ("Text unchanged since the Convention was adopted on 23 February 2006 (entered into force 20 August 2013): "
             "the 2006 mirrors, the 2014+2016 consolidated text and the 2014+2016+2018+2022 consolidated text agree word for word "
             "apart from extraction artifacts. Not named in the 2014, 2016, 2018 or 2022 amendment texts.")

ART = ("No substantive variant between sources. Residual diff spans are PDF extraction artifacts only (running headers, page numbers, "
       "line-break hyphenation, spacing before punctuation), inspected individually.")

META = {
 '2.1': {
  'title': "Seafarers' employment agreements", 'sectionLabel': 'T2-REG2.1',
  'section': "Title 2, Regulation 2.1 / Standard A2.1 / Guideline B2.1 (including Guideline B2.1.1)",
  'amendmentHistory': ("Amended once. 2018 (ILC 107, approved 5 June 2018, in force 26 December 2020): Standard A2.1 - new paragraph 7 "
                       "inserted (seafarers' employment agreement continues to have effect while the seafarer is held captive on or off the "
                       "ship as a result of piracy or armed robbery against ships; definitions of piracy and armed robbery). Regulation 2.1, "
                       "Standard A2.1 paragraphs 1-6 and Guideline B2.1 are 2006 text. Not named in the 2014, 2016 or 2022 amendment texts. "
                       "Diff evidence: the single substantive span in consolidated2016 -> consolidated2022 is exactly the inserted paragraph 7."),
  'variantNote': ART + " The two 2006 mirrors differ only in the position of one line break inside Standard A2.1 paragraph 2 ('(except for ships engaged only in domestic voyages):'), same wording.",
  'methodNote': STD_METHOD, 'amendmentSources': [A2018],
 },
 '2.2': {
  'title': 'Wages', 'sectionLabel': 'T2-REG2.2',
  'section': "Title 2, Regulation 2.2 / Standard A2.2 / Guideline B2.2 (including Guidelines B2.2.1 to B2.2.4)",
  'amendmentHistory': ("Amended once. 2018 (ILC 107, approved 5 June 2018, in force 26 December 2020): Standard A2.2 - new paragraph 7 "
                       "inserted (wages and other entitlements continue to be paid during the entire period of captivity following piracy or "
                       "armed robbery, until release and repatriation or death). Everything else is 2006 text. Not named in the 2014, 2016 or "
                       "2022 amendment texts. Diff evidence: the single substantive span in consolidated2016 -> consolidated2022 is exactly the "
                       "inserted paragraph 7."),
  'variantNote': ART, 'methodNote': STD_METHOD, 'amendmentSources': [A2018],
 },
 '1.4': {
  'title': 'Recruitment and placement', 'sectionLabel': 'T1-REG1.4',
  'section': "Title 1, Regulation 1.4 / Standard A1.4 / Guideline B1.4 (including Guideline B1.4.1)",
  'amendmentHistory': ("Amended once in force. 2022 (ILC 110, approved 6 June 2022, in force 23 December 2024): Standard A1.4 paragraph 5(c)(vi) "
                       "replaced - the recruitment and placement service protection system must now also 'ensure that seafarers are informed, "
                       "prior to or in the process of engagement, of their rights under that system'. Everything else is 2006 text. Not named in "
                       "the 2014, 2016 or 2018 amendment texts. Diff evidence: the single substantive span in consolidated2016 -> consolidated2022 "
                       "is exactly that added clause."),
  'pending2025': ("2025 (ILC 113, adopted 6 June 2025, NOT in force, expected 23 December 2027): Guideline B1.4.1 - new paragraph 2(l) "
                  "(measures to prevent and address violence and harassment, including sexual harassment, bullying and sexual assault, in "
                  "recruitment and placement processes), with the conjunction moved from 2(j) to 2(k). Not blended into fullText."),
  'variantNote': ART + " The two 2006 mirrors differ in one capitalisation ('the'/'The'), same wording.",
  'methodNote': STD_METHOD, 'amendmentSources': [A2022, A2025],
 },
 '2.4': {
  'title': 'Entitlement to leave', 'sectionLabel': 'T2-REG2.4',
  'section': "Title 2, Regulation 2.4 / Standard A2.4 / Guideline B2.4 (including Guidelines B2.4.1 to B2.4.4)",
  'amendmentHistory': UNCHANGED + " Diff evidence: no substantive span in either consolidated comparison.",
  'pending2025': ("2025 (ILC 113, adopted 6 June 2025, NOT in force, expected 23 December 2027): the heading 'Standard A2.4 - Entitlement to "
                  "leave' becomes 'Standard A2.4.1 - Annual leave'; a new 'Standard A2.4.2 - Shore leave' (paragraphs 1-7) and a new 'Guideline "
                  "B2.4.5 - Facilitation of shore leave' are added. Not blended into fullText; the in-force heading A2.4 is kept."),
  'variantNote': ART + " One 2006 mirror drops the word 'consistent' at a page boundary (extraction artifact, the other mirror and both consolidated texts carry it).",
  'methodNote': STD_METHOD, 'amendmentSources': [A2025],
 },
 '2.5': {
  'title': 'Repatriation', 'sectionLabel': 'T2-REG2.5',
  'section': "Title 2, Regulation 2.5 / Standards A2.5.1 and A2.5.2 / Guideline B2.5 (including Guidelines B2.5.1 to B2.5.3)",
  'amendmentHistory': ("Amended in three rounds in force. 2014 (ILC 103, approved 11 June 2014, in force 18 January 2017): Standard A2.5 renamed "
                       "'Standard A2.5.1 - Repatriation'; new 'Standard A2.5.2 - Financial security' (abandonment, paragraphs 1-14) inserted; new "
                       "'Guideline B2.5.3 - Financial security' inserted; Appendix A2-I (evidence of financial security) added (appendix not part of "
                       "this block). 2018 (ILC 107, in force 26 December 2020): Guideline B2.5.1 paragraph 8 replaced (entitlement does not lapse "
                       "while held captive after piracy or armed robbery). 2022 (ILC 110, in force 23 December 2024): Standard A2.5.1 - new "
                       "paragraph 9 inserted (prompt repatriation including when deemed abandoned; port, flag and labour-supplying State "
                       "cooperation) and former paragraph 9 renumbered 10; Appendix A2-I item (g) replaced (registered owner) - appendix only. "
                       "Diff evidence: original -> consolidated2016 shows exactly the A2.5 -> A2.5.1 rename and the A2.5.2 and B2.5.3 insertions; "
                       "consolidated2016 -> consolidated2022 shows exactly the new A2.5.1 paragraph 9 and the B2.5.1 paragraph 8 replacement."),
  'pending2025': ("2025 (ILC 113, adopted 6 June 2025, NOT in force, expected 23 December 2027): Standard A2.5.1 - new paragraph 3 (minimum "
                  "repatriation costs borne by the shipowner) with renumbering, and new paragraph 10 (repatriation without discrimination); "
                  "Guideline B2.5.1 paragraph 3 replaced; new 'Guideline B2.5.2 - Key workers' inserted with renumbering of the following "
                  "Guidelines. Not blended into fullText."),
  'variantNote': ART, 'methodNote': STD_METHOD, 'amendmentSources': [A2014, A2018, A2022, A2025],
 },
 '4.1': {
  'title': 'Medical care on board ship and ashore', 'sectionLabel': 'T4-REG4.1',
  'section': "Title 4, Regulation 4.1 / Standard A4.1 / Guideline B4.1 (including Guidelines B4.1.1 to B4.1.5)",
  'amendmentHistory': ("Amended once in force. 2022 (ILC 110, approved 6 June 2022, in force 23 December 2024): Standard A4.1 - new paragraphs "
                       "5 (prompt disembarkation of seafarers needing immediate medical care) and 6 (repatriation of the body or ashes of a "
                       "seafarer who died during a voyage); Guideline B4.1.3 - new paragraphs 4 and 5; Guideline B4.1.4 paragraph 1(k) replaced. "
                       "Everything else is 2006 text. Not named in the 2014, 2016 or 2018 amendment texts. Diff evidence: the substantive spans in "
                       "consolidated2016 -> consolidated2022 are exactly those insertions and the 1(k) wording change ('the'/'their', 'or those', "
                       "'kin, as appropriate')."),
  'pending2025': ("2025 (ILC 113, adopted 6 June 2025, NOT in force, expected 23 December 2027): Guideline B4.1.1 paragraphs 2 and 4 amended "
                  "(International Medical Guide for Seafarers and Fishers added to the reference guides). Not blended into fullText."),
  'variantNote': ART, 'methodNote': STD_METHOD, 'amendmentSources': [A2022, A2025],
 },
 '4.2': {
  'title': "Shipowners' liability", 'sectionLabel': 'T4-REG4.2',
  'section': "Title 4, Regulation 4.2 / Standards A4.2.1 and A4.2.2 / Guidelines B4.2.1 and B4.2.2",
  'amendmentHistory': ("Amended once in force within this block. 2014 (ILC 103, approved 11 June 2014, in force 18 January 2017): Standard A4.2 "
                       "renamed 'Standard A4.2.1 - Shipowners' liability' and extended with new paragraphs 8-14 (financial security for "
                       "contractual claims in case of death or long-term disability); new 'Standard A4.2.2 - Treatment of contractual claims'; "
                       "Guideline B4.2 renamed B4.2.1; new 'Guideline B4.2.2 - Treatment of contractual claims'; Appendices A4-I and B4-I added. "
                       "2022 (ILC 110): Appendix A4-I item (g) replaced (registered owner) - appendix only, no change inside this block. Diff "
                       "evidence: original -> consolidated2016 shows exactly the renames and insertions; consolidated2016 -> consolidated2022 "
                       "shows no substantive span."),
  'variantNote': ART, 'methodNote': STD_METHOD, 'amendmentSources': [A2014, A2022],
 },
 '4.3': {
  'title': 'Health and safety protection and accident prevention', 'sectionLabel': 'T4-REG4.3',
  'section': "Title 4, Regulation 4.3 / Standard A4.3 / Guideline B4.3 (including Guidelines B4.3.1 to B4.3.11)",
  'amendmentHistory': ("Amended in two rounds in force. 2016 (ILC 105, approved 9 June 2016, in force 8 January 2019): Guideline B4.3.1 "
                       "paragraph 1 - sentence added referring to the ICS/ITF 'Guidance on eliminating shipboard harassment and bullying'; "
                       "Guideline B4.3.1 paragraph 4 - new subparagraph (d) 'harassment and bullying'; Guideline B4.3.6 paragraph 2 - new "
                       "subparagraph (g) 'problems arising from harassment and bullying'. 2022 (ILC 110, in force 23 December 2024): Standard "
                       "A4.3 paragraph 1(b) replaced (appropriately-sized personal protective equipment); Standard A4.3 paragraph 5 chapeau "
                       "replaced, new subparagraph 5(a) (all deaths investigated, recorded and reported annually to the ILO) with former (a)-(c) "
                       "renumbered (b)-(d); Guideline B4.3.5 - new paragraphs 4 and 5 (fatality data). Diff evidence: original -> "
                       "consolidated2016 shows exactly the three 2016 insertions; consolidated2016 -> consolidated2022 shows exactly the 2022 "
                       "changes (one apparent move of '(c) exposure to harmful noise and vibration levels' is a diff-alignment artifact of the "
                       "renumbering, same wording)."),
  'pending2025': ("2025 (ILC 113, adopted 6 June 2025, NOT in force, expected 23 December 2027): Standard A4.3 - new paragraph 1(e) and new "
                  "paragraphs 2(e)-(h) on shipboard violence and harassment; Guideline B4.3.1 paragraphs 1, 2(m) and 4(d) amended; Guideline "
                  "B4.3.6 paragraph 2(g) amended and new paragraph 3; Guideline B4.3.11 new paragraph 4. Not blended into fullText."),
  'variantNote': ART, 'methodNote': STD_METHOD, 'amendmentSources': [A2016, A2022, A2025],
 },
 '3.1': {
  'title': 'Accommodation and recreational facilities', 'sectionLabel': 'T3-REG3.1',
  'section': "Title 3, Regulation 3.1 / Standard A3.1 / Guideline B3.1 (including Guidelines B3.1.1 to B3.1.12)",
  'amendmentHistory': ("Amended once in force. 2022 (ILC 110, approved 6 June 2022, in force 23 December 2024): Standard A3.1 paragraph 17 "
                       "replaced ('including social connectivity'); Guideline B3.1.11 paragraph 4(j) replaced (ship-to-shore telephone "
                       "communications at reasonable charges; the words 'and email and Internet facilities' removed); Guideline B3.1.11 - new "
                       "paragraph 8 (internet access on board at reasonable charges). Everything else is 2006 text. Not named in the 2014, 2016 "
                       "or 2018 amendment texts. Diff evidence: the substantive spans in consolidated2016 -> consolidated2022 are exactly those "
                       "three changes."),
  'pending2025': ("2025 (ILC 113, adopted 6 June 2025, NOT in force, expected 23 December 2027): Guideline B3.1.10 - new paragraph 1(d) "
                  "(menstrual hygiene products and means of disposal). Not blended into fullText."),
  'variantNote': ART + " The 2006 mirrors carry two typographical extraction defects ('con truction'/'contruction', '(hereinafer') that the consolidated texts do not; wording identical.",
  'methodNote': STD_METHOD, 'amendmentSources': [A2022, A2025],
 },
 '3.2': {
  'title': 'Food and catering', 'sectionLabel': 'T3-REG3.2',
  'section': "Title 3, Regulation 3.2 / Standard A3.2 / Guideline B3.2 (including Guidelines B3.2.1 and B3.2.2)",
  'amendmentHistory': ("Amended once in force. 2022 (ILC 110, approved 6 June 2022, in force 23 December 2024): Standard A3.2 paragraphs 2(a) "
                       "and 2(b) replaced (food and drinking water 'provided free of charge during the period of engagement'; meals 'adequate, "
                       "varied, balanced and nutritious'); Standard A3.2 paragraph 7(a) replaced (inspection of supplies 'in relation to their "
                       "quantity, nutritional value, quality and variety'). Everything else is 2006 text. Not named in the 2014, 2016 or 2018 "
                       "amendment texts. Diff evidence: the three substantive spans in consolidated2016 -> consolidated2022 are exactly those "
                       "replacements."),
  'variantNote': ART + " One 2006 mirror misspells 'hygiene' as 'hygene' (mirror typo).",
  'methodNote': STD_METHOD, 'amendmentSources': [A2022],
 },
 '4.4': {
  'title': 'Access to shore-based welfare facilities', 'sectionLabel': 'T4-REG4.4',
  'section': "Title 4, Regulation 4.4 / Standard A4.4 / Guideline B4.4 (including Guidelines B4.4.1 to B4.4.6)",
  'amendmentHistory': ("Amended once in force. 2022 (ILC 110, approved 6 June 2022, in force 23 December 2024): Guideline B4.4.2 - new "
                       "paragraph 5 inserted ('Members should, so far as is reasonably practicable, provide seafarers on board ships in their "
                       "ports and at their associated anchorages with internet access, with charges, if any, being reasonable in amount') and "
                       "the former paragraphs 5-8 renumbered 6-9. Regulation 4.4, Standard A4.4 and all other Guidelines are 2006 text. Not "
                       "named in the 2014, 2016 or 2018 amendment texts. Diff evidence: the substantive spans in consolidated2016 -> "
                       "consolidated2022 are exactly the inserted paragraph and the renumbering. CORRECTION 2026-09-13: the first version of "
                       "this file (commit 24c824a, 2026-09-08) recorded 'No mention found in the 2018, 2022, or 2025 amendment rounds' and "
                       "carried the 2006 text of Guideline B4.4.2; that was wrong - the 2022 amendment round did amend Guideline B4.4.2. The "
                       "error was found by re-diffing the committed fullText against the ILO 2022 consolidated text on 2026-09-12 and is "
                       "corrected here with the amended text and this note; the earlier reading was not silently overwritten."),
  'pending2025': ("2025 (ILC 113, adopted 6 June 2025, NOT in force, expected 23 December 2027): Guideline B4.4.6 paragraph 2 amended "
                  "(detained seafarers to be dealt with promptly under due process of law and with appropriate consular protection, taking "
                  "due account of the ILO/IMO Guidelines on Fair Treatment of Seafarers detained in connection with alleged crimes). Not "
                  "blended into fullText."),
  'variantNote': ART, 'methodNote': STD_METHOD, 'amendmentSources': [A2022, A2025],
 },
 '5.1.1': {'title': 'General principles', 'sectionLabel': 'T5-REG5.1.1', 'section': 'Title 5, Regulation 5.1.1 / Standard A5.1.1 / Guideline B5.1.1',
           'amendmentHistory': UNCHANGED, 'variantNote': ART, 'methodNote': STD_METHOD, 'amendmentSources': []},
 '5.1.2': {'title': 'Authorization of recognized organizations', 'sectionLabel': 'T5-REG5.1.2', 'section': 'Title 5, Regulation 5.1.2 / Standard A5.1.2 / Guideline B5.1.2',
           'amendmentHistory': UNCHANGED, 'variantNote': ART, 'methodNote': STD_METHOD, 'amendmentSources': []},
 '5.1.3': {'title': 'Maritime labour certificate and declaration of maritime labour compliance', 'sectionLabel': 'T5-REG5.1.3',
           'section': 'Title 5, Regulation 5.1.3 / Standard A5.1.3 / Guideline B5.1.3',
           'amendmentHistory': ("Amended once. 2016 (ILC 105, approved 9 June 2016, in force 8 January 2019): Standard A5.1.3 paragraph 4 replaced - "
                                "where a renewal inspection has been completed before expiry and the ship still complies, the existing certificate "
                                "may be extended for up to five months until the new certificate is issued; a matching extension endorsement was "
                                "added to the model form in Appendix A5-II (appendix only). Everything else is 2006 text. Not named in the 2014, "
                                "2018 or 2022 amendment texts. Diff evidence: original -> consolidated2016 shows exactly the replaced paragraph 4; "
                                "consolidated2016 -> consolidated2022 shows no substantive span."),
           'variantNote': ART, 'methodNote': STD_METHOD, 'amendmentSources': [A2016]},
 '5.1.4': {'title': 'Inspection and enforcement', 'sectionLabel': 'T5-REG5.1.4', 'section': 'Title 5, Regulation 5.1.4 / Standard A5.1.4 / Guideline B5.1.4',
           'amendmentHistory': UNCHANGED, 'variantNote': ART + " One consolidated edition prints the first paragraph number as '1' without the full stop (typesetting only).",
           'methodNote': STD_METHOD, 'amendmentSources': []},
 '5.1.5': {'title': 'On-board complaint procedures', 'sectionLabel': 'T5-REG5.1.5', 'section': 'Title 5, Regulation 5.1.5 / Standard A5.1.5 / Guideline B5.1.5',
           'amendmentHistory': UNCHANGED,
           'pending2025': ("2025 (ILC 113, adopted 6 June 2025, NOT in force, expected 23 December 2027): Standard A5.1.5 paragraphs 2 and 3 "
                           "amended (right to complain directly to the master, external authorities; safeguards for complainants, victims, "
                           "witnesses and whistle-blowers) and new paragraph 5 (confidentiality). Not blended into fullText."),
           'variantNote': ART, 'methodNote': STD_METHOD, 'amendmentSources': [A2025]},
 '5.1.6': {'title': 'Marine casualties', 'sectionLabel': 'T5-REG5.1.6', 'section': 'Title 5, Regulation 5.1.6 (no Standard or Guideline exists in the in-force text)',
           'amendmentHistory': UNCHANGED + " Structural finding: in the in-force text Regulation 5.1.6 has no Standard A5.1.6 or Guideline B5.1.6.",
           'pending2025': ("2025 (ILC 113, adopted 6 June 2025, NOT in force, expected 23 December 2027): a new 'Standard A5.1.6 - Marine "
                           "casualties' with paragraphs 1 and 2 (IMO Casualty Investigation Code and ILO/IMO fair treatment guidelines; "
                           "cooperation between States) is added. Not blended into fullText."),
           'variantNote': ART, 'methodNote': STD_METHOD, 'amendmentSources': [A2025]},
 '5.2.1': {'title': 'Inspections in port', 'sectionLabel': 'T5-REG5.2.1', 'section': 'Title 5, Regulation 5.2.1 / Standard A5.2.1 / Guideline B5.2.1',
           'amendmentHistory': UNCHANGED, 'variantNote': ART, 'methodNote': STD_METHOD, 'amendmentSources': []},
 '5.2.2': {'title': 'Onshore seafarer complaint-handling procedures', 'sectionLabel': 'T5-REG5.2.2', 'section': 'Title 5, Regulation 5.2.2 / Standard A5.2.2 / Guideline B5.2.2',
           'amendmentHistory': UNCHANGED, 'variantNote': ART + " Hyphenation of 'on-board' differs between editions (typesetting only).",
           'methodNote': STD_METHOD, 'amendmentSources': []},
 '5.3': {'title': 'Labour-supplying responsibilities', 'sectionLabel': 'T5-REG5.3', 'section': 'Title 5, Regulation 5.3 / Standard A5.3 / Guideline B5.3',
         'amendmentHistory': UNCHANGED, 'variantNote': ART, 'methodNote': STD_METHOD, 'amendmentSources': []},
}

# PILOT number -> Regulation, in the Owner-approved order (SEA and wages first, longest Title 3 blocks last, then Title 5)
ORDER = [(10, '2.1'), (11, '2.2'), (12, '1.4'), (13, '2.4'), (14, '2.5'), (15, '4.1'), (16, '4.2'), (17, '4.3'), (18, '3.1'), (19, '3.2'),
         (20, '5.1.1'), (21, '5.1.2'), (22, '5.1.3'), (23, '5.1.4'), (24, '5.1.5'), (25, '5.1.6'), (26, '5.2.1'), (27, '5.2.2'), (28, '5.3')]
