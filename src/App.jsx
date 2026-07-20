import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import './App.css'

function normalizeAnswer(str) {
  return str
    .trim()
    .toLowerCase()
    .replace(/[.,!?'"]/g, '')       // strip punctuation
    .replace(/^(a|an|the)\s+/i, '') // strip leading articles
    .trim()
}

function answersMatch(userAnswer, correctAnswer) {
  return normalizeAnswer(userAnswer) === normalizeAnswer(correctAnswer)
}

function App() {
  const [todayEntry, setTodayEntry] = useState(null)
  const [loading, setLoading] = useState(true)
  const [userAnswer, setUserAnswer] = useState('')
  const [difficulty, setDifficulty] = useState(3)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchTodayPuzzle()
  }, [])

  async function fetchTodayPuzzle() {
    const today = new Date().toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('entries')
      .select('*')
      .eq('date', today)
      .single()

    if (error) {
      console.log('No puzzle found for today yet:', error.message)
      setTodayEntry(null)
    } else {
      setTodayEntry(data)
    }
    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)

    const isCorrect = answersMatch(userAnswer, todayEntry.correct_answer)

    const { data, error } = await supabase
      .from('entries')
      .update({
        user_answer: userAnswer,
        is_correct: isCorrect,
        difficulty_rating: difficulty,
        answered_at: new Date().toISOString(),
      })
      .eq('id', todayEntry.id)
      .select()
      .single()

    if (error) {
      console.log('Error saving answer:', error.message)
    } else {
      setTodayEntry(data)
    }
    setSubmitting(false)
  }

  if (loading) return <div>Loading...</div>

  return (
    <div className="App">
      <h1>Brain Teaser</h1>

      {!todayEntry && <p>No puzzle yet for today — check back soon.</p>}

      {todayEntry && !todayEntry.answered_at && (
        <div>
          <p><strong>Type:</strong> {todayEntry.puzzle_type}</p>
          <p>{todayEntry.puzzle_text}</p>

          <form onSubmit={handleSubmit}>
            <label>
              Your answer:
              <input
                type="text"
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                required
              />
            </label>

            <label>
              How hard did it feel? (1 = easy, 5 = very hard)
              <input
                type="range"
                min="1"
                max="5"
                value={difficulty}
                onChange={(e) => setDifficulty(Number(e.target.value))}
              />
              <span>{difficulty}</span>
            </label>

            <button type="submit" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Answer'}
            </button>
          </form>
        </div>
      )}

      {todayEntry && todayEntry.answered_at && (
        <div>
          <p><strong>Type:</strong> {todayEntry.puzzle_type}</p>
          <p>{todayEntry.puzzle_text}</p>
          <p>
            You answered: <strong>{todayEntry.user_answer}</strong> —{' '}
            {todayEntry.is_correct ? '✅ Correct!' : '❌ Not quite'}
          </p>
          {!todayEntry.is_correct && (
            <p>Correct answer: {todayEntry.correct_answer}</p>
          )}
          <p>You rated this: {todayEntry.difficulty_rating}/5</p>
        </div>
      )}
    </div>
  )
}

export default App