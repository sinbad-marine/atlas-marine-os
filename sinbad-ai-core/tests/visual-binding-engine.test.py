from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path

import pymupdf


SCRIPT = Path(__file__).resolve().parents[1] / "visual-library" / "scripts" / "rebind-complete-library-visuals.py"
SPEC = importlib.util.spec_from_file_location("visual_rebinder", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
SPEC.loader.exec_module(MODULE)


class VisualBindingEngineTest(unittest.TestCase):
    def test_heading_caption_and_local_context_follow_pdf_geometry(self):
        document = pymupdf.open()
        page = document.new_page(width=600, height=800)
        page.insert_text((50, 70), "MOORING ARRANGEMENTS", fontsize=22)
        page.insert_text((50, 320), "Figure 4. Single point mooring anchor chains", fontsize=11)
        page.insert_text((50, 350), "The buoy is held by anchor legs connected to the seabed.", fontsize=10)
        blocks, heading, captions = MODULE.text_layout(page)
        caption, context = MODULE.local_binding(pymupdf.Rect(40, 100, 560, 300), blocks, captions, "")
        self.assertEqual(heading, "MOORING ARRANGEMENTS")
        self.assertEqual(caption, "Figure 4. Single point mooring anchor chains")
        self.assertIn("anchor legs", context)
        document.close()

    def test_repeated_furniture_quality_can_be_rejected_without_deleting_asset(self):
        role, score, reasons = MODULE.quality(
            20, 20, pymupdf.Rect(0, 0, 5, 5), pymupdf.Rect(0, 0, 600, 800),
            None, "", "object",
        )
        self.assertEqual(role, "decorative")
        self.assertLess(score, 0)
        self.assertIn("tiny-object", reasons)


if __name__ == "__main__":
    unittest.main()
