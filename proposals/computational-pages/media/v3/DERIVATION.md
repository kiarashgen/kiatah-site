# Computational page revisions / 2 October 2026

The originals remain in `C:\Users\kiarash\Desktop\compute`. These are presentation derivatives and source-linked inspections, not substitutes for native solver or authoring runs. `../v2/source-manifest.json` records selected byte-identical copies and hashes. The original bridge screenshots are also linked on the structures page.

| Public asset | Source / production | Claim boundary |
| --- | --- | --- |
| `bridge-1` to `bridge-5` light/dark PNG | `scripts/extract_bridge_linework.py` isolates the saved red truss member marks in `karamba/bridge/t1.JPG` to `t5.JPG`; the grid and screenshot background are removed. | Same saved views, not surveyed geometry or an analysed force result. |
| `tower-connected-branch.svg` | `scripts/render_structural_chains.py` validates node IDs and edges against `computational_projects_v2_2026-09-28/data/grasshopper_graphs.json` and the tower branch subset. | A selected connected branch, not a complete definition or verified solve output. |
| `shell-connected-branch.svg` | Same graph check against the shell branch subset; displays all five distinct saved `Loads` components. | Saved wiring and names only. The shell inclination drawing describes geometry, not stress. |
| `hokm-rule.svg` | Saved decision 02 in `media/hokm-replay.json`, including the lead, legal mask, raw argmax and selected action. | One checkpoint decision from simplified rules; Q values are learned action values, not probabilities. |
| `record-31.png`, `crop-31.png`, `crop-65.png`, `crop-82.png` | Frames and display crops from the retained `media/rag-recording.mp4`, selected by `scripts/render_regulation_record.py`. | Historical interface state only; screenshots do not verify answer correctness. |
| `pdf-page-91-airtightness.png` | Cropped original retrieved `Mabhas19.pdf` page shown in the recording at viewer page 91, printed page 72. | Original source PDF, not a newly written or unrelated document. English translation on the page is editorial and separated from the Persian facsimile. |
| `rag-english.vtt` | Timecoded English translation and observation guide prepared after frame inspection of the retained recording. | Summarizes visible moments; not a verbatim transcript or evidence of hidden processing. |

The new 3D member inspector reads `force-study-data.json`. Its five cases are a **later declared first-order frame calculation** on a separate retained truss, not historical results from the group-built bridge. The full 104-member native Karamba solve was not verified. The 14-node Dynamo inspector reads the saved graph, and the IFC explorer reads selected source STEP identities; neither asserts a fresh Revit run or building-code approval.
