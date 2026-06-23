import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './footer';
import { useLanguage } from '../context/LanguageContext';
import { FaFlask, FaLeaf, FaArrowLeft, FaCheckCircle, FaSpinner, FaFileInvoice, FaBookOpen } from 'react-icons/fa';

export default function Fertilizer() {
  const { t } = useLanguage();
  const location = useLocation();
  const report = location.state?.report;

  const [inputs, setInputs] = useState({
    temperature: '',
    humidity: '',
    moisture: '',
    soil_type: 'Sandy',
    crop_type: 'Wheat',
    nitrogen: '',
    phosphorous: '',
    potassium: ''
  });

  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiUsageGuide, setAiUsageGuide] = useState(null);
  const [askingUsage, setAskingUsage] = useState(false);
  const [usageError, setUsageError] = useState(null);

  // Soil Reports Import State
  const [showImportModal, setShowImportModal] = useState(false);
  const [userReports, setUserReports] = useState([]);
  const [fetchingReports, setFetchingReports] = useState(false);
  const [selectedReportRemarks, setSelectedReportRemarks] = useState('');

  useEffect(() => {
    if (report) {
      setInputs({
        temperature: report.temperature !== null && report.temperature !== undefined ? report.temperature.toString() : '26.8', 
        humidity: report.humidity !== null && report.humidity !== undefined ? report.humidity.toString() : '64.5',    
        moisture: report.moisture ? report.moisture.toString() : '',
        soil_type: report.soilType || 'Sandy',
        crop_type: report.cropType || 'Wheat',
        nitrogen: report.nitrogen ? report.nitrogen.toString() : '',
        phosphorous: report.phosphorous ? report.phosphorous.toString() : '',
        potassium: report.potassium ? report.potassium.toString() : ''
      });
      if (report.remarks) {
        setSelectedReportRemarks(report.remarks);
      }
    }
  }, [report]);

  const handleInputChange = (e) => {
    setInputs({ ...inputs, [e.target.name]: e.target.value });
  };

  const handleOpenImportModal = async () => {
    setShowImportModal(true);
    setFetchingReports(true);
    try {
      const res = await fetch('/api/soil/my-requests', {
        headers: { 'Authorization': localStorage.getItem('token') || '' }
      });
      const data = await res.json();
      if (res.ok) {
        // Filter only completed reports that have NPK parameters
        const completed = (data.requests || []).filter(r => r.status === 'Completed');
        setUserReports(completed);
      } else {
        alert('Failed to load soil reports.');
      }
    } catch (err) {
      console.error(err);
      alert('Error fetching soil reports.');
    } finally {
      setFetchingReports(false);
    }
  };

  const handleApplyReport = (rep) => {
    setInputs({
      temperature: rep.temperature !== null && rep.temperature !== undefined ? rep.temperature.toString() : '26.8',
      humidity: rep.humidity !== null && rep.humidity !== undefined ? rep.humidity.toString() : '64.5',
      moisture: rep.moisture !== null && rep.moisture !== undefined ? rep.moisture.toString() : '',
      soil_type: rep.soilType || 'Sandy',
      crop_type: rep.cropType || 'Wheat',
      nitrogen: rep.nitrogen !== null && rep.nitrogen !== undefined ? rep.nitrogen.toString() : '',
      phosphorous: rep.phosphorous !== null && rep.phosphorous !== undefined ? rep.phosphorous.toString() : '',
      potassium: rep.potassium !== null && rep.potassium !== undefined ? rep.potassium.toString() : ''
    });
    setSelectedReportRemarks(rep.remarks || '');
    setShowImportModal(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setAiUsageGuide(null);
    setUsageError(null);
    try {
      const res = await fetch('/api/ml/predict/fertilizer', {
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
      } else {
        alert(data.error || 'Prediction failed');
      }
    } catch (err) {
      alert('Network error.');
    } finally {
      setLoading(false);
    }
  };

  const handleFetchDetailedUsage = async () => {
    if (!prediction) return;
    setAskingUsage(true);
    setAiUsageGuide(null);
    setUsageError(null);
    const token = localStorage.getItem('token');
    
    const promptText = `Provide detailed application guidelines for the recommended fertilizer: "${prediction.recommendation}" for growing "${inputs.crop_type}" in "${inputs.soil_type}" soil.
Soil chemistry parameters: Nitrogen (N): ${inputs.nitrogen}, Phosphorus (P): ${inputs.phosphorous}, Potassium (K): ${inputs.potassium}.
Environmental parameters: Temperature: ${inputs.temperature}°C, Humidity: ${inputs.humidity}%, Soil Moisture: ${inputs.moisture}%.
Please provide details on:
1. Exact application dosage (quantity per acre/hectare).
2. Ideal time & growth stage for application.
3. Best methods (broadcasting, drilling, foliar, etc.).
4. Precautions & environmental warnings.`;

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
        setAiUsageGuide(data.answer);
      } else {
        setUsageError(data.message || "Failed to retrieve instructions.");
      }
    } catch (err) {
      console.error(err);
      setUsageError("Network error occurred.");
    } finally {
      setAskingUsage(false);
    }
  };

  return (
    <div style={{ background: 'var(--bg-main)', minHeight: '100vh', color: 'var(--text-body)' }}>
      <Navbar />
      <div className="container py-5" style={{ marginTop: '90px' }}>
        {report && (
          <div className="alert alert-success alert-dismissible fade show mb-4 d-flex justify-content-between align-items-center" role="alert" style={{ borderRadius: '10px' }}>
            <span><strong>🎉 Report Autofilled:</strong> Soil test details for pickup location successfully imported.</span>
          </div>
        )}

        <div className="row g-4 justify-content-center">
          {/* Input Form */}
          <div className="col-md-6">
            <div className="card shadow border-0 p-4" style={{ background: 'var(--bg-card)', color: 'var(--text-body)', borderRadius: '15px' }}>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h2 className="mb-0 d-flex align-items-center" style={{ fontWeight: 700, color: 'var(--text-color)' }}>
                  <FaFlask className="me-2" /> {t('soilAdvisorTitle') || 'Fertilizer Advisor'}
                </h2>
              </div>
              <p className="text-muted small">{t('soilAdvisorSubtitle') || 'Generate optimal fertilizer recommendations based on soil NPK ratios and environmental chemistry.'}</p>
              
              <form onSubmit={handleSubmit} className="mt-3">
                <div className="row g-2 mb-3">
                  <div className="col-4">
                    <label className="form-label small fw-bold">{t('nitrogenLabel') || 'Nitrogen (N)'}</label>
                    <input type="number" name="nitrogen" className="form-control" value={inputs.nitrogen} onChange={handleInputChange} placeholder="e.g. 50" required style={{ background: 'var(--bg-input)', color: 'var(--text-color)', border: '1px solid rgba(255,255,255,0.1)' }} />
                  </div>
                  <div className="col-4">
                    <label className="form-label small fw-bold">{t('phosphorusLabel') || 'Phosphorus (P)'}</label>
                    <input type="number" name="phosphorous" className="form-control" value={inputs.phosphorous} onChange={handleInputChange} placeholder="e.g. 40" required style={{ background: 'var(--bg-input)', color: 'var(--text-color)', border: '1px solid rgba(255,255,255,0.1)' }} />
                  </div>
                  <div className="col-4">
                    <label className="form-label small fw-bold">{t('potassiumLabel') || 'Potassium (K)'}</label>
                    <input type="number" name="potassium" className="form-control" value={inputs.potassium} onChange={handleInputChange} placeholder="e.g. 45" required style={{ background: 'var(--bg-input)', color: 'var(--text-color)', border: '1px solid rgba(255,255,255,0.1)' }} />
                  </div>
                </div>

                <div className="row g-2 mb-3">
                  <div className="col-4">
                    <label className="form-label small fw-bold">{t('temperatureLabel') || 'Temp (°C)'}</label>
                    <input type="number" step="0.1" name="temperature" className="form-control" value={inputs.temperature} onChange={handleInputChange} placeholder="e.g. 26.5" required style={{ background: 'var(--bg-input)', color: 'var(--text-color)', border: '1px solid rgba(255,255,255,0.1)' }} />
                  </div>
                  <div className="col-4">
                    <label className="form-label small fw-bold">{t('humidityLabel') || 'Humidity (%)'}</label>
                    <input type="number" step="0.1" name="humidity" className="form-control" value={inputs.humidity} onChange={handleInputChange} placeholder="e.g. 65" required style={{ background: 'var(--bg-input)', color: 'var(--text-color)', border: '1px solid rgba(255,255,255,0.1)' }} />
                  </div>
                  <div className="col-4">
                    <label className="form-label small fw-bold">{t('moistureLabel') || 'Moisture (%)'}</label>
                    <input type="number" step="0.1" name="moisture" className="form-control" value={inputs.moisture} onChange={handleInputChange} placeholder="e.g. 40" required style={{ background: 'var(--bg-input)', color: 'var(--text-color)', border: '1px solid rgba(255,255,255,0.1)' }} />
                  </div>
                </div>

                <div className="row g-2 mb-4">
                  <div className="col-6">
                    <label className="form-label small fw-bold">{t('soilTypeLabel') || 'Soil Type'}</label>
                    <select name="soil_type" className="form-select" value={inputs.soil_type} onChange={handleInputChange} style={{ background: 'var(--bg-input)', color: 'var(--text-color)', border: '1px solid rgba(255,255,255,0.1)' }}>
                      {['Sandy', 'Loamy', 'Black', 'Red', 'Clayey'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="col-6">
                    <label className="form-label small fw-bold">{t('cropTypeLabel') || 'Crop Type'}</label>
                    <select name="crop_type" className="form-select" value={inputs.crop_type} onChange={handleInputChange} style={{ background: 'var(--bg-input)', color: 'var(--text-color)', border: '1px solid rgba(255,255,255,0.1)' }}>
                      {['Sugarcane', 'Paddy', 'Wheat', 'Maize', 'Cotton', 'Tobacco', 'Barley', 'Millets', 'Oil seeds', 'Pulses', 'Ground Nuts', 'Pomegranate'].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <button 
                  type="button" 
                  className="btn btn-outline-success w-100 py-2 mb-2 d-flex align-items-center justify-content-center gap-2"
                  onClick={handleOpenImportModal}
                  style={{ fontWeight: 600, borderRadius: '10px' }}
                >
                  <FaFileInvoice /> {t('importSoilReport') || 'Import Soil Report'}
                </button>
                <button type="submit" className="btn btn-success w-100 py-2 d-flex align-items-center justify-content-center gap-2" disabled={loading} style={{ fontWeight: 600, borderRadius: '10px' }}>
                  {loading && <FaSpinner className="spin-animation" />}
                  {loading ? (t('calculating') || 'Calculating...') : (t('generateRecommendation') || 'Generate Advisor Recommendation')}
                </button>
              </form>

              {/* Remarks/Summary display if a report has been imported */}
              {selectedReportRemarks && (
                <div className="card p-3 mt-4 text-start shadow-sm border-0" style={{ background: 'rgba(25, 135, 84, 0.05)', borderLeft: '4px solid var(--text-color)', borderRadius: '10px' }}>
                  <span className="fw-bold text-success d-flex align-items-center gap-1 mb-1" style={{ fontSize: '0.9rem' }}>
                    <FaBookOpen /> {t('soilTestSummary') || 'Soil Test Summary / Remarks'}
                  </span>
                  <p className="mb-0 text-muted small" style={{ lineHeight: '1.5' }}>
                    {selectedReportRemarks}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Report Display */}
          <div className="col-md-5">
            <div className="card shadow border-0 p-4 h-100 d-flex flex-column justify-content-center align-items-center text-center" style={{ background: 'var(--bg-card)', color: 'var(--text-body)', borderRadius: '15px', minHeight: '350px' }}>
              {prediction ? (
                <div className="animate__animated animate__fadeIn w-100">
                  <div className="mb-3 text-success fs-1">
                    <FaLeaf />
                  </div>
                  <h1 className="fw-bold" style={{ color: 'var(--text-color)' }}>{prediction.recommendation}</h1>
                  <h4 className="mt-2 text-muted">Recommended Fertilizer</h4>

                  <div className="card p-4 mt-4 text-start shadow-sm border-0" style={{ background: 'rgba(255,255,255,0.03)', borderLeft: '6px solid var(--text-color)', borderRadius: '10px' }}>
                    <h5 className="fw-bold mb-2 text-success">💡 Application Guidelines</h5>
                    <p className="mb-0 text-muted" style={{ lineHeight: '1.6', fontSize: '0.95rem' }}>{prediction.guidelines}</p>
                  </div>

                  {!aiUsageGuide && (
                    <button
                      type="button"
                      onClick={handleFetchDetailedUsage}
                      className="btn btn-sm mt-3 px-3 py-2 rounded-3 fw-bold d-flex align-items-center gap-2 mx-auto"
                      disabled={askingUsage}
                      style={{ border: 'none', background: 'linear-gradient(135deg, #2e7d32 0%, #1565c0 100%)', color: '#fff', transition: 'all 0.3s ease' }}
                    >
                      {askingUsage ? (
                        <>
                          <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                          Consulting AI...
                        </>
                      ) : (
                        <>
                          🤖 Explain Usage in Detail (AI)
                        </>
                      )}
                    </button>
                  )}

                  {aiUsageGuide && (
                    <div className="card p-3 mt-3 text-start shadow-sm border-0 text-body" style={{ background: 'rgba(21, 101, 192, 0.05)', borderLeft: '4px solid #1565c0', borderRadius: '10px' }}>
                      <h6 className="fw-bold mb-2 text-primary d-flex align-items-center gap-2">
                        🤖 AI Application Guidelines (Gemini)
                      </h6>
                      <p className="mb-0 text-muted small" style={{ lineHeight: '1.5', whiteSpace: 'pre-line' }}>
                        {aiUsageGuide}
                      </p>
                    </div>
                  )}

                  {usageError && (
                    <div className="alert alert-danger mt-3 mb-0 py-2 small text-start">
                      ⚠️ {usageError}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-muted p-5">
                  <FaFlask className="fs-1 text-success mb-3" />
                  <h4>No Advisory Generated</h4>
                  <p className="mb-0">Please complete the soil testing metrics form on the left to invoke the fertilizer recommendation model.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Reports Popup Modal */}
      {showImportModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content" style={{ background: 'var(--bg-card)', color: 'var(--text-body)', border: '1px solid var(--border-color)', borderRadius: '15px' }}>
              <div className="modal-header border-bottom" style={{ borderColor: 'var(--border-color)' }}>
                <h5 className="modal-title fw-bold text-success">Import Soil Test Report</h5>
                <button type="button" className="btn-close" onClick={() => setShowImportModal(false)} style={{ filter: 'var(--is-dark) ? "invert(1)" : "none"' }}></button>
              </div>
              <div className="modal-body" style={{ maxHeight: '450px', overflowY: 'auto' }}>
                {fetchingReports ? (
                  <div className="text-center py-5">
                    <div className="spinner-border text-success" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                    <p className="text-muted mt-2">Loading your soil test reports...</p>
                  </div>
                ) : userReports.length === 0 ? (
                  <div className="text-center py-5 text-muted">
                    <p className="mb-1">No completed soil test reports found on your profile.</p>
                    <small>You can request a soil sample collection pickup from your dashboard.</small>
                  </div>
                ) : (
                  <div className="d-flex flex-column gap-3">
                    <p className="text-muted small mb-2">Select a completed report from the list below to automatically apply its details to the advisor form.</p>
                    {userReports.map((rep) => (
                      <div key={rep._id} className="card bg-transparent border p-3 rounded-3" style={{ borderColor: 'var(--border-color)' }}>
                        <div className="d-flex justify-content-between align-items-start mb-2 flex-wrap gap-2">
                          <div>
                            <h6 className="fw-bold mb-1 text-success">
                              Report Date: {rep.reportDate ? new Date(rep.reportDate).toLocaleDateString() : 'N/A'}
                            </h6>
                            <small className="text-muted">Collected at: {rep.address}</small>
                          </div>
                          <button 
                            type="button" 
                            className="btn btn-success btn-sm fw-semibold"
                            onClick={() => handleApplyReport(rep)}
                            style={{ borderRadius: '6px' }}
                          >
                            Apply Report
                          </button>
                        </div>
                        <div className="row g-2 text-start mt-2">
                          <div className="col-6 col-sm-3">
                            <small className="text-muted d-block">Nitrogen (N)</small>
                            <span className="fw-bold">{rep.nitrogen}</span>
                          </div>
                          <div className="col-6 col-sm-3">
                            <small className="text-muted d-block">Phosphorus (P)</small>
                            <span className="fw-bold">{rep.phosphorous}</span>
                          </div>
                          <div className="col-6 col-sm-3">
                            <small className="text-muted d-block">Potassium (K)</small>
                            <span className="fw-bold">{rep.potassium}</span>
                          </div>
                          <div className="col-6 col-sm-3">
                            <small className="text-muted d-block">Moisture / pH</small>
                            <span className="fw-bold">{rep.moisture}% / {rep.ph}</span>
                          </div>
                        </div>
                        <div className="row g-2 text-start mt-1">
                          <div className="col-6 col-sm-3">
                            <small className="text-muted d-block">Soil Type</small>
                            <span className="badge bg-success bg-opacity-10 text-success">{rep.soilType || 'N/A'}</span>
                          </div>
                          <div className="col-6 col-sm-3">
                            <small className="text-muted d-block">Target Crop</small>
                            <span className="badge bg-success bg-opacity-10 text-success">{rep.cropType || 'N/A'}</span>
                          </div>
                          <div className="col-6 col-sm-3">
                            <small className="text-muted d-block">Temp / Humidity</small>
                            <span className="fw-bold">{rep.temperature ? `${rep.temperature}°C` : 'N/A'} / {rep.humidity ? `${rep.humidity}%` : 'N/A'}</span>
                          </div>
                        </div>
                        {rep.remarks && (
                          <div className="mt-3 p-2 rounded small" style={{ background: 'rgba(25, 135, 84, 0.03)', borderLeft: '3px solid var(--text-color)' }}>
                            <span className="fw-bold text-success d-block mb-1">Remarks:</span>
                            <span className="text-muted">{rep.remarks}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="modal-footer border-top" style={{ borderColor: 'var(--border-color)' }}>
                <button type="button" className="btn btn-light" onClick={() => setShowImportModal(false)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin-animation { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}
