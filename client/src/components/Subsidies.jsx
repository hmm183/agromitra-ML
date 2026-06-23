import React, { useState, useRef, useEffect } from 'react';
import Navbar from './Navbar';
import Footer from './footer';
import { useLanguage } from '../context/LanguageContext';
import { FaBookmark, FaComments, FaPaperPlane, FaRobot, FaFilter, FaSpinner } from 'react-icons/fa';

export default function Subsidies() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('matcher'); // 'matcher' or 'chatbot'

  // Matcher state
  const [filter, setFilter] = useState({
    state: '',
    crop: '',
    land_acres: '',
    income: ''
  });
  const [subsidies, setSubsidies] = useState([]);
  const [loadingMatcher, setLoadingMatcher] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cat = params.get('category');
    if (cat) {
      if (cat.toLowerCase().includes('agri')) setSelectedCategory('Agriculture');
      else if (cat.toLowerCase().includes('fin')) setSelectedCategory('Finance');
      else if (cat.toLowerCase().includes('tech')) setSelectedCategory('Technology');
    }
  }, []);

  // Chatbot state
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([]);
  const [sendingMessage, setSendingMessage] = useState(false);

  useEffect(() => {
    setMessages(prev => {
      if (prev.length <= 1) {
        return [{ 
          sender: 'bot', 
          text: t('botWelcome') || 'Namaste! I am your AgroMitra Subsidy Assistant. Ask me anything about government schemes, loans, crop insurance, or solar pump subsidies (e.g. "How to register for PM Kisan?").' 
        }];
      }
      return prev;
    });
  }, [t]);
  const chatEndRef = useRef(null);

  const handleFilterChange = (e) => {
    setFilter({ ...filter, [e.target.name]: e.target.value });
  };

  const handleMatch = async (e) => {
    if (e) e.preventDefault();
    setLoadingMatcher(true);
    try {
      const res = await fetch('/api/ml/predict/subsidies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': localStorage.getItem('token')
        },
        body: JSON.stringify(filter)
      });
      const data = await res.json();
      if (res.ok) {
        setSubsidies(data.subsidies || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMatcher(false);
    }
  };

  // Run initial match on page load
  useEffect(() => {
    handleMatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!query.trim() || sendingMessage) return;

    const userQuery = query;
    setMessages(prev => [...prev, { sender: 'user', text: userQuery }]);
    setQuery('');
    setSendingMessage(true);

    try {
      const res = await fetch('/api/ml/query/subsidy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': localStorage.getItem('token')
        },
        body: JSON.stringify({ query: userQuery })
      });
      const data = await res.json();
      if (res.ok) {
        setMessages(prev => [...prev, { sender: 'bot', text: data.answer }]);
      } else {
        setMessages(prev => [...prev, { sender: 'bot', text: t('botError') || 'Sorry, I am facing trouble connecting to the advisory server. Please try again.' }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { sender: 'bot', text: t('botNetworkError') || 'Network connection issue.' }]);
    } finally {
      setSendingMessage(false);
    }
  };

  // Scroll to bottom on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sendingMessage]);

  return (
    <div style={{ background: 'var(--bg-main)', minHeight: '100vh', color: 'var(--text-body)' }}>
      <Navbar />
      <div className="container py-5" style={{ marginTop: '90px' }}>
        
        {/* Navigation Tabs */}
        <div className="d-flex justify-content-center mb-4">
          <div className="btn-group" role="group" style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '5px' }}>
            <button 
              type="button" 
              className={`btn px-4 ${activeTab === 'matcher' ? 'btn-success' : 'btn-link text-success'}`}
              onClick={() => setActiveTab('matcher')}
              style={{ fontWeight: 600, border: 'none', borderRadius: '8px', textDecoration: 'none' }}
            >
              <FaBookmark className="me-2" /> {t('subsidiesTitle') || 'Subsidy Matcher'}
            </button>
            <button 
              type="button" 
              className={`btn px-4 ${activeTab === 'chatbot' ? 'btn-success' : 'btn-link text-success'}`}
              onClick={() => setActiveTab('chatbot')}
              style={{ fontWeight: 600, border: 'none', borderRadius: '8px', textDecoration: 'none' }}
            >
              <FaComments className="me-2" /> {t('aiChatSubtitle') || 'Schemes Q&A Bot'}
            </button>
          </div>
        </div>

        {activeTab === 'matcher' ? (
          <div className="row g-4">
            {/* Filter Form */}
            <div className="col-md-4">
              <div className="card shadow border-0 p-4" style={{ background: 'var(--bg-card)', color: 'var(--text-body)', borderRadius: '15px' }}>
                <h3 className="mb-3 d-flex align-items-center" style={{ fontWeight: 700 }}>
                  <FaFilter className="me-2 text-success" /> {t('filterEligibility') || 'Filter Eligibility'}
                </h3>
                <p className="text-muted small">{t('subsidiesSubtitle') || 'Select credentials to check eligibility for central and state farming benefits.'}</p>
                
                <form onSubmit={handleMatch} className="mt-3">
                  <div className="mb-3">
                    <label className="form-label">{t('matcherFormState') || 'State'}</label>
                    <select name="state" className="form-select" value={filter.state} onChange={handleFilterChange} style={{ background: 'var(--bg-input)', color: 'var(--text-body)', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <option value="">{t('allCentral') || 'All / Central'}</option>
                      {['Andhra Pradesh', 'Telangana', 'Uttar Pradesh', 'Haryana', 'Karnataka', 'Punjab'].map(st => <option key={st} value={st}>{st}</option>)}
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">{t('matcherFormCrop') || 'Primary Crop'}</label>
                    <select name="crop" className="form-select" value={filter.crop} onChange={handleFilterChange} style={{ background: 'var(--bg-input)', color: 'var(--text-body)', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <option value="">{t('allCrops') || 'All Crops'}</option>
                      {['Cereals', 'Vegetables', 'Fruits'].map(cr => <option key={cr} value={cr}>{cr}</option>)}
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">{t('matcherFormLand') || 'Total Land Holding (Acres)'}</label>
                    <input type="number" name="land_acres" className="form-control" value={filter.land_acres} onChange={handleFilterChange} placeholder="e.g. 4" style={{ background: 'var(--bg-input)', color: 'var(--text-body)', border: '1px solid rgba(255,255,255,0.1)' }} />
                  </div>
                  <div className="mb-4">
                    <label className="form-label">{t('matcherFormIncome') || 'Annual Family Income (₹)'}</label>
                    <input type="number" name="income" className="form-control" value={filter.income} onChange={handleFilterChange} placeholder="e.g. 200000" style={{ background: 'var(--bg-input)', color: 'var(--text-body)', border: '1px solid rgba(255,255,255,0.1)' }} />
                  </div>
                  <button type="submit" className="btn btn-success w-100 py-2" disabled={loadingMatcher}>
                    {loadingMatcher ? (t('searching') || 'Searching...') : (t('matcherCheckBtn') || 'Find Matches')}
                  </button>
                </form>
              </div>
            </div>

            {/* Subsidies List */}
            <div className="col-md-8">
              <div className="card shadow border-0 p-4" style={{ background: 'var(--bg-card)', color: 'var(--text-body)', borderRadius: '15px' }}>
                <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-2">
                  <h3 className="mb-0" style={{ fontWeight: 700 }}>{t('matchedSchemes') || 'Eligible Subsidies & Benefits'}</h3>
                  <div className="d-flex flex-wrap gap-1">
                    {['All', 'Agriculture', 'Finance', 'Technology'].map(cat => {
                      const catKey = cat === 'All' ? 'categoryAll' : cat === 'Agriculture' ? 'categoryAgri' : cat === 'Finance' ? 'categoryFinance' : 'categoryTech';
                      return (
                        <button
                          key={cat}
                          type="button"
                          className={`btn btn-sm ${selectedCategory === cat ? 'btn-success' : 'btn-outline-success text-success'}`}
                          onClick={() => setSelectedCategory(cat)}
                          style={{ borderRadius: '20px', fontWeight: 600, fontSize: '0.85rem' }}
                        >
                          {t(catKey) || cat}
                        </button>
                      );
                    })}
                  </div>
                </div>
                
                {loadingMatcher ? (
                  <div className="text-center py-5">
                    <FaSpinner className="spinner-border spinner-border-sm text-success" />
                  </div>
                ) : (subsidies.filter(s => selectedCategory === 'All' || s.category.toLowerCase() === selectedCategory.toLowerCase()).length === 0) ? (
                  <div className="text-center py-5 text-muted">
                    <p>{t('noSchemesMatch') || `No schemes match your parameters for ${selectedCategory}.`}</p>
                  </div>
                ) : (
                  <div className="d-flex flex-column gap-3">
                    {subsidies
                      .filter(s => selectedCategory === 'All' || s.category.toLowerCase() === selectedCategory.toLowerCase())
                      .map((scheme, idx) => (
                      <div 
                        key={idx} 
                        className="card p-3 border-0 shadow-sm" 
                        style={{ 
                          background: 'rgba(255,255,255,0.03)', 
                          borderRadius: '10px', 
                          borderLeft: `5px solid ${scheme.is_eligible ? 'var(--text-color)' : 'var(--border-color)'}` 
                        }}
                      >
                        <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
                          <div>
                            <span className="badge bg-secondary mb-2 me-2">{t(scheme.category)}</span>
                            {scheme.is_eligible ? (
                              <span className="badge bg-success mb-2">{t('eligible') || 'Eligible'}</span>
                            ) : (
                              <span className="badge bg-danger mb-2">{t('ineligible') || 'Ineligible'} ({t('matches') || 'Matches'} {scheme.match_percentage}%)</span>
                            )}
                            <h5 className="fw-bold mb-1 mt-1">{t(scheme.scheme)}</h5>
                            <p className="text-muted small mb-2">{t(scheme.description)}</p>
                          </div>
                          <div className="text-end">
                            <small className="text-muted d-block">{t('benefitValue') || 'Benefit Value'}</small>
                            <span className="fs-4 fw-bold text-success">₹{(scheme.subsidy_amount || 0).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Chatbot UI */
          <div className="card shadow border-0 mx-auto" style={{ background: 'var(--bg-card)', color: 'var(--text-body)', borderRadius: '15px', maxWidth: '800px', height: '600px', display: 'flex', flexDirection: 'column' }}>
            <div className="card-header border-0 p-3 bg-success text-white d-flex align-items-center" style={{ borderTopLeftRadius: '15px', borderTopRightRadius: '15px' }}>
              <FaRobot className="fs-3 me-2" />
              <div>
                <h5 className="mb-0 fw-bold">{t('advisoryBotTitle') || 'Advisory Scheme Bot'}</h5>
                <small style={{ opacity: 0.8 }}>{t('advisoryBotSubtitle') || 'Agricultural Scheme Assistant'}</small>
              </div>
            </div>
            
            {/* Message Feed */}
            <div className="p-4 flex-grow-1 overflow-auto d-flex flex-column gap-3" style={{ background: 'var(--bg-main)' }}>
              {messages.map((msg, idx) => (
                <div 
                  key={idx} 
                  className={`d-flex ${msg.sender === 'user' ? 'justify-content-end' : 'justify-content-start'}`}
                >
                  <div className="d-flex gap-2 max-width-75" style={{ maxWidth: '75%' }}>
                    {msg.sender === 'bot' && (
                      <div className="bg-success text-white rounded-circle d-flex align-items-center justify-content-center" style={{ width: '32px', height: '32px', flexShrink: 0 }}>
                        <FaRobot size={14} />
                      </div>
                    )}
                    <div 
                      className={`p-3 rounded`}
                      style={{ 
                        background: msg.sender === 'user' ? '#2e7d32' : 'var(--bg-card)', 
                        color: msg.sender === 'user' ? '#fff' : 'var(--text-body)',
                        borderRadius: msg.sender === 'user' ? '15px 15px 0 15px' : '15px 15px 15px 0',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                        whiteSpace: 'pre-line'
                      }}
                    >
                      {msg.text}
                    </div>
                  </div>
                </div>
              ))}
              {sendingMessage && (
                <div className="d-flex justify-content-start">
                  <div className="d-flex gap-2">
                    <div className="bg-success text-white rounded-circle d-flex align-items-center justify-content-center" style={{ width: '32px', height: '32px' }}>
                      <FaRobot size={14} />
                    </div>
                    <div className="p-3 bg-secondary rounded text-white" style={{ borderRadius: '15px 15px 15px 0' }}>
                      <span className="spinner-grow spinner-grow-sm me-1" role="status" />
                      <span className="spinner-grow spinner-grow-sm me-1" role="status" />
                      <span className="spinner-grow spinner-grow-sm" role="status" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSendMessage} className="p-3 border-top" style={{ borderColor: 'rgba(255,255,255,0.05)', background: 'var(--bg-card)', borderBottomLeftRadius: '15px', borderBottomRightRadius: '15px' }}>
              <div className="input-group">
                <input
                  type="text"
                  className="form-control py-2"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('botPlaceholder') || 'Type your subsidy question here...'}
                  style={{ background: 'var(--bg-input)', color: 'var(--text-body)', border: '1px solid rgba(255,255,255,0.1)' }}
                  required
                />
                <button type="submit" className="btn btn-success px-4" disabled={sendingMessage}>
                  <FaPaperPlane />
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
