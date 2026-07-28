import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import './App.css'

const TYPE_COLORS = {
  spatial: 'var(--spatial)',
  logical: 'var(--logical)',
  'lateral thinking': 'var(--lateral)',
  numerical: 'var(--numerical)',
  verbal: 'var(--verbal)',
}

const TYPE_ORDER = ['spatial', 'logical', 'lateral thinking', 'numerical', 'verbal']

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

  const [report, setReport] = useState(null)
  const [reportLoading, setReportLoading] = useState(false)

  const [archive, setArchive] = useState([])
  const [archiveLoading, setArchiveLoading] = useState(false)

  useEffect(() => { fetchTodayPuzzle() }, [])
  useEffect(() => { if (view === 'reports') fetchLatestReport() }, [view])
  useEffect(() => { if (view === 'archive') fetchArchive() }, [view])

  async function fetchTodayPuzzle() {
    const today = new Date().toISOString().split('T')[0]
    const { data, error } = await supabase
      .from('entries').select('*').eq('date', today).single()
    setTodayEntry(error ? null : data)
    setLoading(false)
  }

  async function fetchLatestReport() {
    setReportLoading(true)
    const { data, error } = await supabase
      .from('weekly_reports')
      .select('*')
      .order('week_end', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!error) setReport(data)
    setReportLoading(false)
  }

  async function fetchArchive() {
    setArchiveLoading(true)
    const { data, error } = await supabase
      .from('entries')
      .select('*')
      .not('answered_at', 'is', null)
      .order('date', { ascending: false })
    if (!error) setArchive(data)
    setArchiveLoading(false)
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

  const tabColor = todayEntry
    ? (TYPE_COLORS[todayEntry.puzzle_type] || 'var(--graphite)')
    : 'var(--graphite)'

  // group archive entries by puzzle_type, in a fixed, readable order
  const archiveByType = TYPE_ORDER
    .map((type) => ({
      type,
      entries: archive.filter((e) => e.puzzle_type === type),
    }))
    .filter((group) => group.entries.length > 0)

  return (
    <div className="App">
      <h1>Brain Teaser</h1>

      <nav>
        <button className={view === 'today' ? 'active' : ''} onClick={() => setView('today')}>
          Today
        </button>
        <button className={view === 'archive' ? 'active' : ''} onClick={() => setView('archive')}>
          Archive
        </button>
        <button className={view === 'reports' ? 'active' : ''} onClick={() => setView('reports')}>
          Reports
        </button>
      </nav>

      {view === 'today' && (
        <>
          {loading && <p className="empty-state">Loading...</p>}

          {!loading && !todayEntry && (
            <p className="empty-state">No puzzle yet for today — check back soon.</p>
          )}

          {!loading && todayEntry && !todayEntry.answered_at && (
            <div className="card">
              <div className="card-tab" style={{ background: tabColor }} />
              <div className="card-body">
                <p className="card-type">{todayEntry.puzzle_type}</p>
                <p className="card-puzzle">{todayEntry.puzzle_text}</p>

                <form onSubmit={handleSubmit}>
                  <label>
                    Your answer
                    <input
                      type="text"
                      value={userAnswer}
                      onChange={(e) => setUserAnswer(e.target.value)}
                      required
                    />
                  </label>

                  <label>
                    How hard did it feel? (1–5)
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={difficulty}
                      onChange={(e) => setDifficulty(Number(e.target.value))}
                    />
                    <span> {difficulty}</span>
                  </label>

                  <button type="submit" disabled={submitting}>
                    {submitting ? 'Submitting...' : 'Submit Answer'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {!loading && todayEntry && todayEntry.answered_at && (
            <div className="card">
              <div className="card-tab" style={{ background: tabColor }} />
              <div className="card-body">
                <p className="card-type">{todayEntry.puzzle_type}</p>
                <p className="card-puzzle">{todayEntry.puzzle_text}</p>
                <p className="result-line">
                  You answered: <strong>{todayEntry.user_answer}</strong> —{' '}
                  <span className={todayEntry.is_correct ? 'result-correct' : 'result-incorrect'}>
                    {todayEntry.is_correct ? 'Correct' : 'Not quite'}
                  </span>
                </p>
                {!todayEntry.is_correct && (
                  <p className="result-line">Correct answer: {todayEntry.correct_answer}</p>
                )}
                <p className="difficulty-tag">Rated {todayEntry.difficulty_rating}/5</p>
              </div>
            </div>
          )}
        </>
      )}

      {view === 'archive' && (
        <div>
          {archiveLoading && <p className="empty-state">Loading archive...</p>}
          {!archiveLoading && archiveByType.length === 0 && (
            <p className="empty-state">No answered puzzles yet.</p>
          )}

          {archiveByType.map((group) => (
            <div className="archive-group" key={group.type}>
              <div className="archive-group-header">
                <span
                  className="type-dot"
                  style={{ background: TYPE_COLORS[group.type] || 'var(--graphite)' }}
                />
                <h3 className="archive-group-title">{group.type}</h3>
                <span className="archive-group-count">{group.entries.length}</span>
              </div>

              {group.entries.map((e) => (
                <div className="archive-item" key={e.id}>
                  <div className="archive-item-top">
                    <span className="archive-date">{e.date}</span>
                    <span className={e.is_correct ? 'result-correct' : 'result-incorrect'}>
                      {e.is_correct ? 'Correct' : 'Not quite'}
                    </span>
                  </div>
                  <p className="archive-puzzle">{e.puzzle_text}</p>
                  <p className="archive-answer">
                    You answered: <strong>{e.user_answer}</strong>
                    {!e.is_correct && <> — correct: {e.correct_answer}</>}
                  </p>
                  <p className="difficulty-tag">Rated {e.difficulty_rating}/5</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {view === 'reports' && (
        <div>
          {reportLoading && <p className="empty-state">Loading report...</p>}
          {!reportLoading && !report && (
            <p className="empty-state">No report yet — generate one from the GitHub Actions tab.</p>
          )}

          {!reportLoading && report && (
            <div className="report-group">
              <h3 className="report-week">{report.week_start} — {report.week_end}</h3>

              {report.report_json?.insight_points?.length > 0 && (
                <div className="insight-headline">
                  <p className="box-label box-label-insight">This week's insight</p>
                  {report.report_json.insight_points.map((point, i) => (
                    <p className="insight-line" key={i}>{point}</p>
                  ))}
                </div>
              )}

              <div className="report-grid">
                {report.report_json?.by_type && (
                  <div className="box">
                    <p className="box-label">Accuracy by type</p>
                    <div className="type-breakdown">
                      {report.report_json.by_type.map((t) => (
                        <div className="type-row" key={t.type}>
                          <span
                            className="type-dot"
                            style={{ background: TYPE_COLORS[t.type] || 'var(--graphite)' }}
                          />
                          <span className="type-name">{t.type}</span>
                          <span className="type-stat">{t.accuracy}%</span>
                          <span className="type-stat">felt {t.avg_difficulty}/5</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {report.report_json?.calibration && (
                  <div className="box">
                    <p className="box-label">Calibration</p>
                    <p className="box-text">{report.report_json.calibration}</p>
                  </div>
                )}
              </div>

              {report.report_json?.pattern && (
                <div className="box box-full">
                  <p className="box-label">Pattern</p>
                  <p className="box-text">{report.report_json.pattern}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default App