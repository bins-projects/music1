import json
from pathlib import Path


ROOT = Path(__file__).parents[1]


def test_study_module_question_ids_resolve_to_supported_pack_questions():
    catalog = json.loads((ROOT / "web/data/study-modules.json").read_text())
    assert catalog["format"] == "prepflow_study_module_catalog"

    packs = {
        pack_id: json.loads((ROOT / path).read_text())
        for pack_id, path in {
            "pharmacy": "packs/pharmacy.prepflow.json",
            "medical_surgical": "packs/medical_surgical.prepflow.json",
            "appendix_d": "packs/appendix_d.prepflow.json",
        }.items()
    }
    supported_types = {
        "mc",
        "multiple_choice",
        "multiple_response",
        "completion",
        "ordered_response",
    }

    for entry in catalog["modules"]:
        manifest = json.loads((ROOT / "web" / entry["manifest_path"].removeprefix("./")).read_text())
        assert manifest["format"] == "prepflow_module_selection"
        assert manifest["module_id"] == entry["id"]

        references = []
        for group in manifest["groups"]:
            questions = {q["id"]: q for q in packs[group["source_pack_id"]]["questions"]}
            for chapter in group["chapters"]:
                ids = chapter["question_ids"]
                assert len(ids) == chapter["expected_question_count"]
                references.extend((group["source_pack_id"], qid) for qid in ids)
                for question_id in ids:
                    assert question_id in questions
                    assert questions[question_id].get("type", questions[question_id].get("question_type")) in supported_types

        assert len(references) == entry["question_count"]
        assert len(references) == len(set(references))


def test_study_module_assets_are_in_the_offline_cache():
    service_worker = (ROOT / "web/sw.js").read_text()
    pack_precache = (ROOT / "web/pack-precache.js").read_text()

    for asset in (
        "./study-modules.css",
        "./data/study-modules.json",
        "./data/study-modules/pharm-test-review-matched-2026.prepflow-module.json",
        "./data/study-modules/pharm-test-review-related-expanded-2026.prepflow-module.json",
    ):
        assert asset in service_worker

    assert "../packs/appendix_d.prepflow.json" in pack_precache
