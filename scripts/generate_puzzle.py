import os
import json
import random
from datetime import date
from supabase import create_client
from anthropic import Anthropic

supabase = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_ROLE_KEY"]
)
claude = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

PUZZLE_TYPES = ["spatial", "logical", "lateral thinking", "numerical", "verbal"]

def pick_puzzle_type():
    recent = supabase.table("entries") \
        .select("puzzle_type") \
        .order("date", desc=True) \
        .limit(3) \
        .execute()
    recent_types = {row["puzzle_type"] for row in recent.data}
    choices = [t for t in PUZZLE_TYPES if t not in recent_types]
    if not choices:
        choices = PUZZLE_TYPES
    return random.choice(choices)

def generate_puzzle(puzzle_type):
    prompt = f"""Generate one original {puzzle_type} brain teaser puzzle.

Respond with ONLY valid JSON, no other text, in this exact format:
{{"puzzle_text": "...", "correct_answer": "..."}}

The puzzle should be solvable in a few minutes, genuinely interesting, and not a
famous/overused riddle. The correct_answer should be short (a word or short phrase)."""

    response = claude.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=500,
        messages=[{"role": "user", "content": prompt}]
    )

    text = response.content[0].text.strip()
    text = text.replace("```json", "").replace("```", "").strip()
    return json.loads(text)

def main():
    today = date.today().isoformat()

    existing = supabase.table("entries").select("id").eq("date", today).execute()
    if existing.data:
        print(f"Puzzle already exists for {today}, skipping.")
        return

    puzzle_type = pick_puzzle_type()
    puzzle = generate_puzzle(puzzle_type)

    supabase.table("entries").insert({
        "date": today,
        "puzzle_type": puzzle_type,
        "puzzle_text": puzzle["puzzle_text"],
        "correct_answer": puzzle["correct_answer"],
    }).execute()

    print(f"Inserted {puzzle_type} puzzle for {today}")

if __name__ == "__main__":
    main()