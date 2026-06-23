import React, { useState } from 'react';
import Navbar from './Navbar';
import Footer from './footer';
import { useLanguage } from '../context/LanguageContext';
import { FaCloudSun, FaCloudRain, FaSnowflake, FaSun, FaSpinner, FaMapMarkerAlt, FaCalendarAlt } from 'react-icons/fa';

export default function Weather() {
  const { t } = useLanguage();
  const [inputs, setInputs] = useState({
    precipitation: '',
    temp_max: '',
    temp_min: '',
    wind: ''
  });
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Weekly Observatory State
  const [weeklyData, setWeeklyData] = useState(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [showWeekly, setShowWeekly] = useState(false);

  // AI Weather advisory state
  const [aiAdvisory, setAiAdvisory] = useState(null);
  const [fetchingAiAdvisory, setFetchingAiAdvisory] = useState(false);
  const [aiAdvisoryError, setAiAdvisoryError] = useState(null);

  const handleFetchDetailedWeatherAdvice = async (isWeekly = false, dateLabel = '') => {
    setFetchingAiAdvisory(true);
    setAiAdvisory(null);
    setAiAdvisoryError(null);
    const token = localStorage.getItem('token');
    
    let promptText = '';
    if (isWeekly && selectedDay) {
      promptText = `For the weather forecast on ${dateLabel || selectedDay.date}:
Predicted condition: ${selectedDay.predictedCondition}.
Precipitation: ${selectedDay.precipitation} mm, Max Temp: ${selectedDay.temp_max}°C, Min Temp: ${selectedDay.temp_min}°C, Wind Speed: ${selectedDay.wind} km/h.
The default advisory is: "${selectedDay.advice}".
Provide a highly detailed, comprehensive, in-depth agricultural advisory and action plan for a farmer for this day. Include irrigation steps, crop protection instructions, and pesticide safety guidelines.`;
    } else if (prediction) {
      promptText = `For the predicted weather condition: "${prediction.prediction}".
Precipitation: ${inputs.precipitation} mm, Max Temp: ${inputs.temp_max}°C, Min Temp: ${inputs.temp_min}°C, Wind Speed: ${inputs.wind} km/h.
The default advisory is: "${prediction.advice}".
Provide a highly detailed, comprehensive, in-depth agricultural advisory and action plan for a farmer for these weather conditions. Include irrigation adjustments, crop protection steps, and sowing or harvesting guides.`;
    } else {
      setFetchingAiAdvisory(false);
      return;
    }

    try {
      const res = await fetch('/api/queries/ask-gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token || ''
        },
        body: JSON.stringify({ query: promptText, inDepth: true })
      });
      const data = await res.json();
      if (res.ok) {
        setAiAdvisory(data.answer);
      } else {
        setAiAdvisoryError(data.message || "Failed to retrieve detailed instructions.");
      }
    } catch (err) {
      console.error(err);
      setAiAdvisoryError("Network error occurred.");
    } finally {
      setFetchingAiAdvisory(false);
    }
  };

  const handleInputChange = (e) => {
    setInputs({ ...inputs, [e.target.name]: e.target.value });
  };

  const handleAutoFill = () => {
    setLoading(true);
    setError('');
    setAiAdvisory(null);
    setAiAdvisoryError(null);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            const res = await fetch(`/api/weather/live?lat=${latitude}&lon=${longitude}`, {
              headers: { 'Authorization': localStorage.getItem('token') || '' }
            });
            const data = await res.json();
            if (res.ok) {
              setInputs({
                precipitation: data.precipitation.toString(),
                temp_max: data.temp_max.toString(),
                temp_min: data.temp_min.toString(),
                wind: data.wind.toString()
              });
            } else {
              setError('Failed to fetch live weather from government OpenWeather API.');
            }
          } catch (err) {
            setError('Error connecting to weather service.');
          } finally {
            setLoading(false);
          }
        },
        async (error) => {
          await fetchDefaultWeather();
        }
      );
    } else {
      fetchDefaultWeather();
    }
  };

  const fetchDefaultWeather = async () => {
    try {
      const res = await fetch(`/api/weather/live?city=Delhi`, {
        headers: { 'Authorization': localStorage.getItem('token') || '' }
      });
      const data = await res.json();
      if (res.ok) {
        setInputs({
          precipitation: data.precipitation.toString(),
          temp_max: data.temp_max.toString(),
          temp_min: data.temp_min.toString(),
          wind: data.wind.toString()
        });
      } else {
        setError('Failed to fetch default weather.');
      }
    } catch (err) {
      setError('Error fetching default weather data.');
    } finally {
      setLoading(false);
    }
  };

  const handleWeeklyObservatory = () => {
    setLoading(true);
    setError('');
    setAiAdvisory(null);
    setAiAdvisoryError(null);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          await fetchWeeklyForecast(`/api/weather/weekly?lat=${latitude}&lon=${longitude}`);
        },
        async () => {
          await fetchWeeklyForecast('/api/weather/weekly?city=Delhi');
        }
      );
    } else {
      fetchWeeklyForecast('/api/weather/weekly?city=Delhi');
    }
  };

  const fetchWeeklyForecast = async (url) => {
    setAiAdvisory(null);
    setAiAdvisoryError(null);
    try {
      const res = await fetch(url, {
        headers: { 'Authorization': localStorage.getItem('token') || '' }
      });
      const data = await res.json();
      if (res.ok) {
        setWeeklyData(data);
        setSelectedDayIndex(0);
        setShowWeekly(true);
      } else {
        setError(data.error || 'Failed to fetch weekly forecast');
      }
    } catch (err) {
      console.error(err);
      setError('Network error fetching forecast.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setAiAdvisory(null);
    setAiAdvisoryError(null);
    try {
      const res = await fetch('/api/ml/predict/weather', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': localStorage.getItem('token')
        },
        body: JSON.stringify(inputs)
      });
      const data = await res.json();
      if (res.ok) {
        setPrediction(data);
        setShowWeekly(false); // Switch to single view
      } else {
        setError(data.error || 'Prediction failed');
      }
    } catch (err) {
      setError('Network error running prediction.');
    } finally {
      setLoading(false);
    }
  };

  const getWeatherIcon = (cond, sizeClass = "fs-1") => {
    if (!cond) return null;
    const c = cond.toLowerCase();
    if (c.includes('rain')) return <FaCloudRain className={`text-info ${sizeClass}`} />;
    if (c.includes('sun') || c.includes('clear')) return <FaSun className={`text-warning ${sizeClass}`} />;
    if (c.includes('snow')) return <FaSnowflake className={`text-primary ${sizeClass}`} />;
    if (c.includes('drizzle')) return <FaCloudRain className={`text-secondary ${sizeClass}`} />;
    return <FaCloudSun className={`text-muted ${sizeClass}`} />; // Fog / Overcast
  };

  const formatDayLabel = (dateString) => {
    const date = new Date(dateString);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return {
      dayName: days[date.getDay()],
      dateLabel: `${date.getDate()} ${months[date.getMonth()]}`
    };
  };

  // Helper to color code condition badges
  const getBadgeStyle = (cond) => {
    if (!cond) return {};
    const c = cond.toLowerCase();
    if (c.includes('rain')) return { background: 'rgba(25, 118, 210, 0.15)', color: '#64b5f6', border: '1px solid rgba(25, 118, 210, 0.3)' };
    if (c.includes('sun') || c.includes('clear')) return { background: 'rgba(245, 124, 0, 0.15)', color: '#ffb74d', border: '1px solid rgba(245, 124, 0, 0.3)' };
    if (c.includes('snow')) return { background: 'rgba(2, 136, 209, 0.15)', color: '#4fc3f7', border: '1px solid rgba(2, 136, 209, 0.3)' };
    if (c.includes('drizzle')) return { background: 'rgba(0, 150, 136, 0.15)', color: '#4db6ac', border: '1px solid rgba(0, 150, 136, 0.3)' };
    return { background: 'rgba(117, 117, 117, 0.15)', color: '#b0bec5', border: '1px solid rgba(117, 117, 117, 0.3)' };
  };

  const selectedDay = weeklyData && weeklyData.forecast ? weeklyData.forecast[selectedDayIndex] : null;

  return (
    <div style={{ background: 'var(--bg-main)', minHeight: '100vh', color: 'var(--text-body)' }}>
      <Navbar />
      <div className="container py-5" style={{ marginTop: '90px' }}>
        
        {error && (
          <div className="alert alert-danger alert-dismissible fade show mb-4 border-0 shadow-sm" role="alert" style={{ background: 'rgba(220, 53, 69, 0.1)', color: '#ff6b6b', borderRadius: '10px' }}>
            <span>⚠️ {error}</span>
            <button type="button" className="btn-close btn-close-white" onClick={() => setError('')} aria-label="Close"></button>
          </div>
        )}

        <div className="row g-4 justify-content-center">
          <div className="col-md-5">
            <div className="card shadow border-0 p-4" style={{ background: 'var(--bg-card)', color: 'var(--text-body)', borderRadius: '15px' }}>
              <h2 className="mb-3 d-flex align-items-center" style={{ fontWeight: 700, color: 'var(--text-color)' }}>
                <FaCloudSun className="me-2" /> {t('weatherTitle') || 'Weather Predictor'}
              </h2>
              <p className="text-muted small mb-4">{t('weatherSubtitle') || 'Enter daily weather metrics or trigger the Weekly Observatory to examine week-long crop advice.'}</p>

              {/* Action Buttons */}
              <div className="row g-2 mb-4">
                <div className="col-6">
                  <button 
                    type="button" 
                    className="btn btn-outline-success w-100 py-2 d-flex align-items-center justify-content-center text-center btn-sm"
                    onClick={handleAutoFill}
                    disabled={loading}
                    style={{ fontWeight: 600, borderRadius: '10px', height: '42px' }}
                  >
                    <FaMapMarkerAlt className="me-1" /> {t('sensorAutofill') || 'Sensor Autofill'}
                  </button>
                </div>
                <div className="col-6">
                  <button 
                    type="button" 
                    className="btn btn-success w-100 py-2 d-flex align-items-center justify-content-center text-center gap-2 btn-sm"
                    onClick={handleWeeklyObservatory}
                    disabled={loading}
                    style={{ 
                      background: 'linear-gradient(135deg, var(--btn-3d-border-bottom), var(--btn-3d-bg))', 
                      border: 'none',
                      fontWeight: 600,
                      borderRadius: '10px',
                      height: '42px'
                    }}
                  >
                    🌌 {t('weeklyObservatory') || 'Weekly Observatory'}
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label className="form-label small fw-bold">{t('precipitationLabel') || 'Precipitation (mm)'}</label>
                  <input
                    type="number"
                    step="0.1"
                    name="precipitation"
                    className="form-control"
                    value={inputs.precipitation}
                    onChange={handleInputChange}
                    placeholder="e.g. 2.5"
                    required
                    style={{ background: 'var(--bg-input)', color: 'var(--text-body)', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                </div>
                <div className="row g-2 mb-3">
                  <div className="col-6">
                    <label className="form-label small fw-bold">{t('maxTempLabel') || 'Max Temp (°C)'}</label>
                    <input
                      type="number"
                      step="0.1"
                      name="temp_max"
                      className="form-control"
                      value={inputs.temp_max}
                      onChange={handleInputChange}
                      placeholder="e.g. 32.5"
                      required
                      style={{ background: 'var(--bg-input)', color: 'var(--text-body)', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                  </div>
                  <div className="col-6">
                    <label className="form-label small fw-bold">{t('minTempLabel') || 'Min Temp (°C)'}</label>
                    <input
                      type="number"
                      step="0.1"
                      name="temp_min"
                      className="form-control"
                      value={inputs.temp_min}
                      onChange={handleInputChange}
                      placeholder="e.g. 19.0"
                      required
                      style={{ background: 'var(--bg-input)', color: 'var(--text-body)', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                  </div>
                </div>
                <div className="mb-4">
                  <label className="form-label small fw-bold">{t('windLabel') || 'Wind Speed (km/h)'}</label>
                  <input
                    type="number"
                    step="0.1"
                    name="wind"
                    className="form-control"
                    value={inputs.wind}
                    onChange={handleInputChange}
                    placeholder="e.g. 4.8"
                    required
                    style={{ background: 'var(--bg-input)', color: 'var(--text-body)', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                </div>
                <button type="submit" className="btn btn-success w-100 py-2 d-flex align-items-center justify-content-center gap-2" disabled={loading} style={{ fontWeight: 600, borderRadius: '10px' }}>
                  {loading && <FaSpinner className="spin-animation" />}
                  {loading ? (t('searching') || 'Analyzing...') : (t('predictButtonSingle') || 'Predict Single-Day Weather')}
                </button>
              </form>
            </div>
          </div>

          {/* Results Display */}
          <div className="col-md-7">
            <div className="card shadow border-0 p-4 h-100 d-flex flex-column" style={{ background: 'var(--bg-card)', color: 'var(--text-body)', borderRadius: '15px', minHeight: '450px' }}>
              
              {loading ? (
                <div className="d-flex flex-column justify-content-center align-items-center flex-grow-1 text-center py-5">
                  <div className="spinner-border text-success mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <h5 className="text-muted">Fetching latest atmospheric metrics...</h5>
                  <p className="text-muted small">Executing ML prediction models on live government readings.</p>
                </div>
              ) : showWeekly && weeklyData ? (
                // 🌌 WEEKLY OBSERVATORY UI
                <div className="animate__animated animate__fadeIn d-flex flex-column h-100">
                  <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                    <div>
                      <h4 className="fw-bold mb-0 d-flex align-items-center">
                        🌌 {t('observatoryTitle') || 'Weekly Weather Observatory'}
                      </h4>
                      <small className="text-success fw-bold">📍 {t('stationLabel') || 'Detected Station'}: {weeklyData.name}</small>
                    </div>
                    <span className="badge bg-success bg-opacity-10 text-success px-3 py-2" style={{ borderRadius: '6px' }}>
                      {t('forecastLabel') || '7-Day Forecast'}
                    </span>
                  </div>

                  {/* Horizontal Scroll Day Cards */}
                  <div className="d-flex gap-2 pb-3 mb-4 overflow-x-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
                    {weeklyData.forecast.map((day, idx) => {
                      const { dayName, dateLabel } = formatDayLabel(day.date);
                      const isSelected = idx === selectedDayIndex;
                      return (
                        <div 
                          key={day.date}
                          onClick={() => { setSelectedDayIndex(idx); setAiAdvisory(null); setAiAdvisoryError(null); }}
                          className="p-3 text-center d-flex flex-column align-items-center justify-content-between"
                          style={{
                            minWidth: '92px',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            background: isSelected ? 'rgba(46, 125, 50, 0.2)' : 'rgba(255, 255, 255, 0.02)',
                            border: isSelected ? '2px solid var(--text-color)' : '2px solid rgba(255, 255, 255, 0.05)',
                            transition: 'all 0.2s ease-in-out',
                            transform: isSelected ? 'scale(1.03)' : 'none'
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) e.currentTarget.style.border = '2px solid rgba(46, 125, 50, 0.4)';
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) e.currentTarget.style.border = '2px solid rgba(255, 255, 255, 0.05)';
                          }}
                        >
                          <span className="fw-bold small d-block mb-1">{dayName}</span>
                          <span className="text-muted text-nowrap" style={{ fontSize: '0.75rem' }}>{dateLabel}</span>
                          
                          <div className="my-2">
                            {getWeatherIcon(day.predictedCondition, "fs-3")}
                          </div>

                          <span className="fw-bold text-nowrap mb-2" style={{ fontSize: '0.85rem' }}>
                            {Math.round(day.temp_max)}°<span className="text-muted font-weight-normal">/{Math.round(day.temp_min)}°</span>
                          </span>

                          <span className="badge px-2 py-1" style={{ ...getBadgeStyle(day.predictedCondition), fontSize: '0.7rem' }}>
                            {day.predictedCondition}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Selected Day Details */}
                  {selectedDay && (
                    <div className="card border-0 p-4 flex-grow-1 d-flex flex-column text-start" style={{ background: 'rgba(255, 255, 255, 0.02)', borderRadius: '12px', borderLeft: '5px solid var(--text-color)' }}>
                      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-1">
                        <h5 className="fw-bold mb-0 d-flex align-items-center">
                          <FaCalendarAlt className="text-success me-2" /> 
                          {t('advisoryFor') || 'Advisory for'} {new Date(selectedDay.date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                        </h5>
                        {selectedDay.isExtrapolated && (
                          <span className="text-muted small font-italic" style={{ fontSize: '0.75rem' }}>* Trend Prediction</span>
                        )}
                        {selectedDay.isHistory && (
                          <span className="text-muted small font-italic" style={{ fontSize: '0.75rem' }}>* Historical Observation</span>
                        )}
                      </div>

                      {/* Metric Grid */}
                      <div className="row g-2 mb-4">
                        <div className="col-6 col-sm-3">
                          <div className="p-2 rounded text-center" style={{ background: 'rgba(255,255,255,0.03)' }}>
                            <small className="text-muted d-block text-uppercase" style={{ fontSize: '0.65rem' }}>Rainfall</small>
                            <strong className="fs-6 text-info">{selectedDay.precipitation} mm</strong>
                          </div>
                        </div>
                        <div className="col-6 col-sm-3">
                          <div className="p-2 rounded text-center" style={{ background: 'rgba(255,255,255,0.03)' }}>
                            <small className="text-muted d-block text-uppercase" style={{ fontSize: '0.65rem' }}>Wind</small>
                            <strong className="fs-6 text-secondary">{selectedDay.wind} km/h</strong>
                          </div>
                        </div>
                        <div className="col-6 col-sm-3">
                          <div className="p-2 rounded text-center" style={{ background: 'rgba(255,255,255,0.03)' }}>
                            <small className="text-muted d-block text-uppercase" style={{ fontSize: '0.65rem' }}>Max Temp</small>
                            <strong className="fs-6 text-danger">{selectedDay.temp_max} °C</strong>
                          </div>
                        </div>
                        <div className="col-6 col-sm-3">
                          <div className="p-2 rounded text-center" style={{ background: 'rgba(255,255,255,0.03)' }}>
                            <small className="text-muted d-block text-uppercase" style={{ fontSize: '0.65rem' }}>Min Temp</small>
                            <strong className="fs-6 text-primary">{selectedDay.temp_min} °C</strong>
                          </div>
                        </div>
                      </div>

                      {/* Advisory Text */}
                      <div className="p-3 rounded flex-grow-1" style={{ background: 'rgba(46, 125, 50, 0.05)', border: '1px solid rgba(46, 125, 50, 0.15)' }}>
                        <span className="fw-bold text-success d-flex align-items-center mb-2" style={{ fontSize: '0.95rem' }}>
                          💡 Smart Agricultural Advice:
                        </span>
                        <p className="mb-0 text-muted" style={{ lineHeight: '1.6', fontSize: '0.9rem' }}>
                          {selectedDay.advice}
                        </p>

                        {!aiAdvisory && (
                          <button
                            type="button"
                            onClick={() => {
                              const { dateLabel } = formatDayLabel(selectedDay.date);
                              handleFetchDetailedWeatherAdvice(true, dateLabel);
                            }}
                            className="btn btn-sm mt-3 px-3 py-1.5 rounded-3 fw-bold d-flex align-items-center gap-2"
                            disabled={fetchingAiAdvisory}
                            style={{ border: 'none', background: 'linear-gradient(135deg, #2e7d32 0%, #1565c0 100%)', color: '#fff', transition: 'all 0.3s ease', fontSize: '0.8rem' }}
                          >
                            {fetchingAiAdvisory ? (
                              <>
                                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                Consulting AI...
                              </>
                            ) : (
                              '🤖 Explain Weather Advisory in Depth (AI)'
                            )}
                          </button>
                        )}

                        {aiAdvisory && (
                          <div className="card p-3 mt-3 text-start shadow-sm border-0 text-body animate-fade-in" style={{ background: 'rgba(21, 101, 192, 0.05)', borderLeft: '4px solid #1565c0', borderRadius: '10px' }}>
                            <h6 className="fw-bold text-primary mb-2">🤖 Detailed AI Action Plan (Gemini)</h6>
                            <p className="mb-0 text-muted small" style={{ whiteSpace: 'pre-line', lineHeight: '1.5' }}>
                              {aiAdvisory}
                            </p>
                          </div>
                        )}

                        {aiAdvisoryError && (
                          <div className="alert alert-danger mt-3 mb-0 py-2 small text-start">
                            ⚠️ {aiAdvisoryError}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : prediction ? (
                // 🌡️ SINGLE DAY PREDICTION RESULT
                <div className="animate__animated animate__fadeIn w-100 my-auto text-center py-4">
                  <div className="mb-3">
                    {getWeatherIcon(prediction.prediction, "fs-1")}
                  </div>
                  <h1 className="display-4 fw-bold" style={{ color: 'var(--text-color)' }}>{prediction.prediction}</h1>
                  <h4 className="mt-3 fw-bold">Predicted Condition</h4>
                  
                  <div className="card p-4 mt-4 text-start shadow-sm border-0" style={{ background: 'rgba(255,255,255,0.02)', borderLeft: '6px solid var(--text-color)', borderRadius: '10px' }}>
                    <h5 className="fw-bold mb-2 text-success">💡 Agricultural Smart Advisory</h5>
                    <p className="mb-0 text-muted" style={{ lineHeight: '1.6' }}>{prediction.advice}</p>

                    {!aiAdvisory && (
                      <button
                        type="button"
                        onClick={() => handleFetchDetailedWeatherAdvice(false)}
                        className="btn btn-sm mt-3 px-3 py-1.5 rounded-3 fw-bold d-flex align-items-center gap-2"
                        disabled={fetchingAiAdvisory}
                        style={{ border: 'none', background: 'linear-gradient(135deg, #2e7d32 0%, #1565c0 100%)', color: '#fff', transition: 'all 0.3s ease', fontSize: '0.8rem' }}
                      >
                        {fetchingAiAdvisory ? (
                          <>
                            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                            Consulting AI...
                          </>
                        ) : (
                          '🤖 Explain Weather Advisory in Depth (AI)'
                        )}
                      </button>
                    )}

                    {aiAdvisory && (
                      <div className="card p-3 mt-3 text-start shadow-sm border-0 text-body animate-fade-in" style={{ background: 'rgba(21, 101, 192, 0.05)', borderLeft: '4px solid #1565c0', borderRadius: '10px' }}>
                        <h6 className="fw-bold text-primary mb-2">🤖 Detailed AI Action Plan (Gemini)</h6>
                        <p className="mb-0 text-muted small" style={{ whiteSpace: 'pre-line', lineHeight: '1.5' }}>
                          {aiAdvisory}
                        </p>
                      </div>
                    )}

                    {aiAdvisoryError && (
                      <div className="alert alert-danger mt-3 mb-0 py-2 small text-start">
                        ⚠️ {aiAdvisoryError}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                // 🌤️ DEFAULT EMPTY STATE
                <div className="text-muted p-5 my-auto text-center w-100">
                  <FaCloudSun className="display-3 text-success mb-3" />
                  <h4 className="fw-bold text-color">Atmospheric Analysis</h4>
                  <p className="mb-4 small max-width-350 mx-auto text-muted">Fill out daily parameters on the left, or open the Weekly Observatory to assess 7-day predicted cycles and crop-growing guides.</p>
                  
                  <button 
                    type="button" 
                    className="btn btn-success px-4 py-2"
                    onClick={handleWeeklyObservatory}
                    style={{ background: 'linear-gradient(135deg, var(--btn-3d-border-bottom), var(--btn-3d-bg))', border: 'none', fontWeight: 600, borderRadius: '10px' }}
                  >
                    🌌 Launch Weekly Observatory
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <Footer />

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin-animation { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}
