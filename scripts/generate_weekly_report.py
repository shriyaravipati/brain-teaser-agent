import os
from datetime import date, timedelta
from supabase import create_client
from anthropic import Anthropic

supabase = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_ROLE_KEY"]
)
claude = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

def main():
    today = date.today()
    week_start = today - timedelta(days=7)

    entries = supabase.table("entries") \
        .select("*") \
        .gte("date", week_start.isoformat()) \
        .lte("date", today.isoformat()) \
        .not_.is_("answered_at", "null") \
        .order("date") \
        .execute()

    if not entries.data:
        print("No answered puzzles this week — nothing to report on.")
        return

    summary_lines = []
    for e in entries.data:
        summary_lines.append(
            f"- {e['date']} | type: {e['puzzle_type']} | "
            f"correct: {e['is_correct']} | difficulty rated: {e['difficulty_rating']}/5 | "
            f"puzzle: {e['puzzle_text'][:100]}"
        )
    summary_text = "\n".join(summary_lines)

    prompt = f"""Here is one person's brain teaser puzzle data from the past week:

{summary_text}

Write a genuine, specific "brain report" analyzing their thinking patterns. Cover:
1. Which puzzle types they're strongest and weakest at, based on accuracy
2. Whether their self-rated difficulty matches their actual performance — do they
   underestimate or overestimate how hard things are for them, and in which categories?
3. Any real pattern in *how* they seem to approach problems, based on what got right vs wrong
4. One honest, specific insight — not generic encouragement, something that would only be
   true of this particular week's data

Keep it direct and concrete, grounded only in the data above. Do not pad with generic
praise. 250-400 words."""

    response = claude.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=800,
        messages=[{"role": "user", "content": prompt}]
    )

    report_text = response.content[0].text.strip()

    supabase.table("weekly_reports").insert({
        "week_start": week_start.isoformat(),
        "week_end": today.isoformat(),
        "report_text": report_text,
    }).execute()

    print("Weekly report generated and saved.")

if __name__ == "__main__":
    main()