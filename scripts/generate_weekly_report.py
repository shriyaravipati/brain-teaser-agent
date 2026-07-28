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

def shorten(text, max_words=14):
    words = str(text).split()
    return text if len(words) <= max_words else " ".join(words[:max_words]) + "..."

def fallback_insight(by_type):
    # used only if Claude's insight comes back empty/malformed, so the section
    # never silently disappears
    if not by_type:
        return ["Not enough data yet to draw a pattern."]
    best = by_type[0]
    worst = by_type[-1]
    points = [f"Strongest so far: {best['type']} at {best['accuracy']}% accuracy."]
    if worst["type"] != best["type"]:
        points.append(f"Weakest so far: {worst['type']} at {worst['accuracy']}% accuracy.")
    return points

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
  "insight": ["point 1", "point 2", "point 3"]
}}

For "insight": give exactly 2-3 items, always as a JSON array of strings, never empty.
Each item must be under 12 words, one single observation, written like a sharp one-line
note — not a full sentence with clauses. Example style: "Numerical puzzles took longest
but had zero errors." Together they should add up to one honest, specific insight true
only of this week's data. No generic encouragement."""

    response = claude.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=600,
        messages=[{"role": "user", "content": prompt}]
    )

    text = response.content[0].text.strip().replace("```json", "").replace("```", "").strip()
    narrative = json.loads(text)

    print("Raw Claude narrative:", narrative)  # visible in Actions logs for debugging

    insight_points = narrative.get("insight")
    if isinstance(insight_points, str):
        insight_points = [insight_points]
    if not isinstance(insight_points, list) or len(insight_points) == 0:
        insight_points = fallback_insight(by_type)
    insight_points = [shorten(p) for p in insight_points if str(p).strip()]
    if not insight_points:
        insight_points = fallback_insight(by_type)

    report_json = {
        "by_type": by_type,
        "calibration": narrative.get("calibration", ""),
        "pattern": narrative.get("pattern", ""),
        "insight_points": insight_points,
    }

    supabase.table("weekly_reports").insert({
        "week_start": week_start.isoformat(),
        "week_end": today.isoformat(),
        "report_json": report_json,
    }).execute()

    print(f"Weekly report generated and saved. Insight points: {insight_points}")

if __name__ == "__main__":
    main()