import os
import json
from datetime import date, timedelta
from collections import defaultdict
from supabase import create_client
from anthropic import Anthropic

supabase = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_ROLE_KEY"]
)
claude = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

def compute_by_type(entries):
    stats = defaultdict(lambda: {"correct": 0, "total": 0, "difficulty_sum": 0})
    for e in entries:
        t = e["puzzle_type"]
        stats[t]["total"] += 1
        stats[t]["correct"] += 1 if e["is_correct"] else 0
        stats[t]["difficulty_sum"] += e["difficulty_rating"] or 0

    by_type = []
    for t, s in stats.items():
        by_type.append({
            "type": t,
            "accuracy": round(100 * s["correct"] / s["total"]),
            "avg_difficulty": round(s["difficulty_sum"] / s["total"], 1),
            "count": s["total"],
        })
    return sorted(by_type, key=lambda x: -x["accuracy"])

def main():
    today = date.today()
    week_start = today - timedelta(days=7)

    entries = supabase.table("entries") \
        .select("*") \
        .gte("date", week_start.isoformat()) \
        .lte("date", today.isoformat()) \
        .not_.is_("answered_at", "null") \
        .order("date") \
        .execute().data

    if not entries:
        print("No answered puzzles this week — nothing to report on.")
        return

    by_type = compute_by_type(entries)

    detail_lines = "\n".join(
        f"- {e['date']} | {e['puzzle_type']} | correct: {e['is_correct']} | "
        f"self-rated difficulty: {e['difficulty_rating']}/5"
        for e in entries
    )
    stats_lines = "\n".join(
        f"- {t['type']}: {t['accuracy']}% accuracy over {t['count']} puzzle(s), "
        f"avg self-rated difficulty {t['avg_difficulty']}/5"
        for t in by_type
    )

    prompt = f"""Per-type stats for the week:
{stats_lines}

Raw daily entries:
{detail_lines}

Respond with ONLY valid JSON, no other text, in this exact format:
{{
  "calibration": "2-3 sentences on whether their self-rated difficulty matches actual performance, and where they over/underestimate",
  "pattern": "2-3 sentences on a real pattern in how they seem to approach problems, based on right vs wrong answers",
  "insight": ["short standalone statement 1", "short standalone statement 2", "short standalone statement 3"]
}}

For "insight": give 2-3 SHORT, punchy, standalone statements (each under 20 words) that
together form one honest, specific insight true only of this week's data. Each statement
should stand on its own, not connect grammatically to the others. No generic encouragement."""

    response = claude.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=600,
        messages=[{"role": "user", "content": prompt}]
    )

    text = response.content[0].text.strip().replace("```json", "").replace("```", "").strip()
    narrative = json.loads(text)

    report_json = {
        "by_type": by_type,
        "calibration": narrative["calibration"],
        "pattern": narrative["pattern"],
        "insight_points": narrative["insight"],
    }

    supabase.table("weekly_reports").insert({
        "week_start": week_start.isoformat(),
        "week_end": today.isoformat(),
        "report_json": report_json,
    }).execute()

    print("Weekly report generated and saved.")

if __name__ == "__main__":
    main()