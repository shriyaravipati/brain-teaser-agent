import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import './App.css'

function normalizeAnswer(str) {
  return str
    .trim()
    .toLowerCase()
    .replace(/[.,!?'"]/g, '')
    .replace(/^(a|an|the)\s+/i, '')
    .trim()
}

function answersMatch(userAnswer, correctAnswer) {
  return normalizeAnswer(userAnswer) === normalizeAnswer(correctAnswer)
}

function App() {
  const [view, setView] = useState('today')
  const [todayEntry, setTodayEntry] = useState(null)
  const [loading, setLoading] = useState(true)
  const [userAnswer, setUserAnswer] = useState('')
  const [difficulty, setDifficulty] = useState(3)
  const [submitting, setSubmitting] = useState(false)
  const [reports, setReports] = useState([])
  const [reportsLoading, setReportsLoading] = useState(false)

  useEffect(() => {
    fetchTodayPuzzle()
  }, [])

  useEffect(() => {
    if (view === 'reports') fetchReports()
  }, [view])

  async function fetchTodayPuzzle() {
    const today = new Date().toISOString().split('T')[0]
    const { data, error } = await supabase
      .from('entries')
      .select('*')
      .eq('date', today)
      .single()

    if (error) {
      setTodayEntry(null)
    } else {
      setTodayEntry(data)
    }
    setLoading(false)
  }

  async function fetchReports() {
    setReportsLoading(true)
    const { data, error } = await supabase
      .from('weekly_reports')
      .select('*')
      .order('week_end', { ascending: false })

    if (!error) setReports(data)
    setReportsLoading(false)
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

    if (!error) setTodayEntry(data)
    setSubmitting(false)
  }

  return (
    <div className="App">
      <h1>Brain Teaser</h1>

      <nav>
        <button onClick={() => setView('today')}>Today</button>
        <button onClick={() => setView('reports')}>Reports</button>
      </nav>

      {view === 'today' && (
        <>
          {loading && <p>Loading...</p>}

          {!loading && !todayEntry && <p>No puzzle yet for today — check back soon.</p>}

          {!loading && todayEntry && !todayEntry.answered_at && (
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

          {!loading && todayEntry && todayEntry.answered_at && (
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
        </>
      )}

      {view === 'reports' && (
        <div>
          {reportsLoading && <p>Loading reports...</p>}
          {!reportsLoading && reports.length === 0 && (
            <p>No reports yet — generate one from the GitHub Actions tab once you've answered a week's worth of puzzles.</p>
          )}
          {reports.map((r) => (
            <div key={r.id} style={{ marginBottom: '2rem', borderBottom: '1px solid #ccc', paddingBottom: '1rem' }}>
              <h3>{r.week_start} to {r.week_end}</h3>
              <p style={{ whiteSpace: 'pre-wrap' }}>{r.report_text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default App