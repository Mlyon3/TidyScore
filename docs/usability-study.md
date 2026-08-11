# TidyScore Five-User Workflow Study

Use this lightweight protocol before promoting, removing, or adding cleanup features. Do not enable analytics or record a participant's CSV.

## Participants and setup

- Recruit five musicians who use forScore regularly and are comfortable using the iPad Files app.
- Ask each participant to bring a representative library or use TidyScore's sample library.
- Run the current deployed build on an iPad. Let the participant work without coaching unless they become completely blocked.
- If a personal CSV is used, confirm that it stays on their device and delete any opt-in recovery copy at the end.

## Tasks

1. Export library metadata from forScore and open it in TidyScore.
2. Explain what TidyScore recommends and what will happen before applying a fix.
3. Review and apply one composer fix, then undo it.
4. Inspect or manually edit one score.
5. Locate any advanced tool they would expect to use.
6. Export the cleaned CSV and apply it back in forScore.
7. With a large fixture, find a score on another page, select all filtered results, and explain the scale warning.
8. Review a formula-risk warning and explain whether TidyScore changes the affected metadata.
9. If the facilitator enables the simulated analysis failure, retry it and continue to edit/export.
10. While a library is open, respond to the update-ready prompt and explain how the current work is protected.

Do not explain button names or navigation while the task is underway. Record the point and wording of every question or hesitation.

## Session record

| Measure | Result |
| --- | --- |
| Import completed without help | Yes / No |
| Understood preview before apply | Yes / No |
| Export and forScore return completed without help | Yes / No |
| Understood local-only privacy | Yes / No |
| Understood pagination/filter scope | Yes / No |
| Understood scale and formula warnings | Yes / No |
| Recovered from analysis unavailable state | Yes / No |
| Understood offline/update behavior | Yes / No |
| Time to completed round trip |  |
| Wrong turns or unclear labels |  |
| Core fixes used or valued |  |
| Advanced tools used or valued |  |
| Suggestions rejected and why |  |

## Feature decision log

Classify each feature after all five sessions:

- **Core:** successfully used or explicitly valued by at least two participants and directly supports the cleanup round trip.
- **Advanced:** useful for a narrower task but not needed for most successful round trips.
- **Evidence required:** unclear, misunderstood, or accepted inconsistently. Keep behind Advanced tools and test again.
- **Removal candidate:** redundant, unused, or repeatedly produces unwanted changes. Remove only after reviewing the underlying participant notes.

Treat Suggest Genre and Suggest Tags as evidence-required by default. Composer era is not necessarily a score's genre, and title keywords may produce unwanted tags.

## Release threshold

The guided workflow is validated when at least four of five participants:

- complete import and export without verbal assistance;
- can explain that previews are not applied automatically;
- understand that CSV contents stay on their device; and
- finish without data loss or unexpected bulk changes.

If the forScore handoff remains the dominant blocker after the instructions and share sheet are tested, document those failures before considering a native share-extension prototype.
