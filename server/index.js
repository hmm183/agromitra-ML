// server/index.js (backend entrypoint)
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const session = require('express-session');
const passport = require('./config/passport');        // Passport setup
const authRoutes = require('./routes/authRoutes');    // Auth-related routes
const jwtAuth = require('./middleware/jwtAuth');      // JWT middleware

const app = express();

// Custom CORS middleware supporting multiple origins from ALLOWED_ORIGINS env var
app.use((req, res, next) => {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim());
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!process.env.ALLOWED_ORIGINS) {
    // Fallback default for local development if env var is missing
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // Instantly resolve CORS preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to Database'))
  .catch((err) => console.error('DB connection error:', err));

// Session & Passport (for OAuth)
app.use(session({
  secret: process.env.SESSION_SECRET || 'session-secret',
  resave: false,
  saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());

// Auth routes (signup, signin, OTP, etc.)
app.use(authRoutes);

// Register admin routes
const adminRoutes = require('./routes/adminRoutes');
app.use('/api/admin', adminRoutes);

// Register payment routes
const paymentRoutes = require('./routes/paymentRoutes');
app.use('/api/payment', paymentRoutes);

// Register soil testing routes
const soilRoutes = require('./routes/soilRoutes');
app.use('/api/soil', soilRoutes);

// Register new routes
const cropRoutes = require('./routes/cropRoutes');
app.use('/api/crops', cropRoutes);

const faqRoutes = require('./routes/faqRoutes');
app.use('/api/faqs', faqRoutes);

const queryRoutes = require('./routes/queryRoutes');
app.use('/api/queries', queryRoutes);

const notificationRoutes = require('./routes/notificationRoutes');
app.use('/api/notifications', notificationRoutes);

const weatherRoutes = require('./routes/weatherRoutes');
app.use('/api/weather', weatherRoutes);

const productRoutes = require('./routes/productRoutes');
app.use('/api/products', productRoutes);

// Proxy ML requests to Flask ML Service
const axios = require('axios');
app.all('/api/ml/*', jwtAuth, async (req, res) => {
  const targetPath = req.url.replace('/api/ml', '');
  const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:5050';
  const targetUrl = `${mlServiceUrl.replace(/\/$/, '')}${targetPath}`;
  try {
    const response = await axios({
      method: req.method,
      url: targetUrl,
      data: req.body,
      headers: { 'Content-Type': 'application/json' }
    });

    // Auto-log successful ML requests to DB activity log
    if (response.status >= 200 && response.status < 300) {
      const Log = require('./models/Log');
      let action = '';
      if (targetPath.includes('/predict/weather')) {
        action = 'Checked Weather Forecast';
      } else if (targetPath.includes('/predict/fertilizer')) {
        action = 'Used Fertilizer Advisor';
      } else if (targetPath.includes('/predict/subsidies')) {
        action = 'Matched Subsidies';
      } else if (targetPath.includes('/query/subsidy')) {
        action = 'Queried Subsidy Assistant';
      } else if (targetPath.includes('/query/website')) {
        action = 'Queried FAQ Assistant';
      }

      if (action) {
        try {
          await new Log({ userId: req.user.id, action }).save();
        } catch (logErr) {
          console.error('Failed to save activity log:', logErr.message);
        }
      }
    }

    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Error proxying to ML service:', error.message);
    
    // Fallback to Gemini/Rules if Flask service is offline
    if (error.code === 'ECONNREFUSED' || error.message.includes('connect ECONNREFUSED')) {
      console.log('Flask ML service is offline. Executing Node.js fallback...');
      const apiKey = process.env.GEMINI_API_KEY;
      
      // 1. Fallback for AI Assistant / Website QA
      if (targetPath.includes('/query/website')) {
        const queryText = req.body.query;
        if (!queryText) {
          return res.json({ answer: "I didn't catch that. Could you please ask a question about AgroMitra?" });
        }
        try {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
          const prompt = `You are the AgroMitra AI Assistant, a helpful support chatbot for the AgroMitra platform.
          The user is asking: "${queryText}".
          Answer their question in a friendly, helpful, and concise manner.
          AgroMitra services:
          1. Live weather forecast with smart advisories.
          2. Crop recommendations based on soil NPK parameters.
          3. Fertilizer suggestion tool.
          4. Live Mandi pricing from data.gov.in.
          5. Government Subsidies matcher.
          6. Crop marketplace for buying/selling.
          7. Soil testing requests (pickup and diagnostics).
          Project Leads:
          - Vrishank Raina (Backend & ML Architect who designed the Node.js/Express APIs, server databases, and built/vectorized the ML recommendation & FAQ models).
          - Raushan Shrivastawa (Frontend Lead and UI/UX Designer who built the React client interface, interactive dashboards, and light/dark theme system).
          Provide a useful answer. Keep it relatively short and direct.`;
          
          const geminiRes = await axios.post(geminiUrl, {
            contents: [{ parts: [{ text: prompt }] }]
          });
          const answer = geminiRes.data?.candidates?.[0]?.content?.parts?.[0]?.text || "I'm sorry, I'm having trouble formulating an answer right now.";
          
          // Log fallback action
          const Log = require('./models/Log');
          try {
            await new Log({ userId: req.user.id, action: 'Queried FAQ Assistant' }).save();
          } catch (logErr) {}
          
          return res.json({ question: queryText, answer: answer.replace(/```[a-z]*/g, '').trim(), score: 1.0 });
        } catch (geminiErr) {
          console.error("Gemini fallback failed:", geminiErr.message);
        }
      }
      
      // 2. Fallback for Subsidy Q&A Bot
      if (targetPath.includes('/query/subsidy')) {
        const queryText = req.body.query;
        if (!queryText) {
          return res.json({ answer: "I didn't catch that. Could you please ask a question about subsidies?" });
        }
        try {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
          const prompt = `You are the AgroMitra Advisory Scheme Bot, a helpful AI assistant specialized in Indian government agricultural schemes and subsidies.
          The user is asking: "${queryText}".
          Provide a clear, detailed, and structured explanation of relevant schemes (such as PM-Kisan, PM Fasal Bima Yojana, PM-KUSUM solar pumps, Kisan Credit Card loans, SMAM tractor subsidies, etc.) that address their question. Keep it simple, clear, and easy for a farmer to understand.`;
          
          const geminiRes = await axios.post(geminiUrl, {
            contents: [{ parts: [{ text: prompt }] }]
          });
          const answer = geminiRes.data?.candidates?.[0]?.content?.parts?.[0]?.text || "I'm sorry, I'm having trouble formulating an answer right now.";
          
          // Log fallback action
          const Log = require('./models/Log');
          try {
            await new Log({ userId: req.user.id, action: 'Queried Subsidy Assistant' }).save();
          } catch (logErr) {}
          
          return res.json({ question: queryText, answer: answer.replace(/```[a-z]*/g, '').trim(), score: 1.0 });
        } catch (geminiErr) {
          console.error("Gemini fallback failed:", geminiErr.message);
        }
      }
      
      // 3. Fallback for Weather Predictor (rules-based)
      if (targetPath.includes('/predict/weather')) {
        const precipitation = parseFloat(req.body.precipitation || 0);
        const temp_max = parseFloat(req.body.temp_max || 25);
        const temp_min = parseFloat(req.body.temp_min || 15);
        const wind = parseFloat(req.body.wind || 4);
        
        let prediction = "Sun";
        let advice = "Sunny conditions. Ideal for harvesting, sowing, and drying grains. Keep soil moisture monitored and irrigate if necessary.";
        
        if (precipitation > 2.5) {
          prediction = "Rain";
          advice = "Heavy rainfall predicted. Postpone spraying pesticides or fertilizers to avoid chemical runoff. Ensure proper soil drainage in crop fields.";
        } else if (temp_min < 5) {
          prediction = "Snow";
          advice = "Freezing temperatures and snow expected. Protect frost-sensitive crops and cover young saplings. Ensure livestock shelter heating.";
        } else if (wind > 8) {
          prediction = "Fog";
          advice = "Foggy and windy conditions. High humidity can encourage pest and fungal growth. Inspect crop leaves closely.";
        } else if (precipitation > 0) {
          prediction = "Drizzle";
          advice = "Light drizzle expected. Favorable for mild soil moisture retention, but monitor wind speed before applying light powders.";
        }
        
        // Log fallback action
        const Log = require('./models/Log');
        try {
          await new Log({ userId: req.user.id, action: 'Checked Weather Forecast' }).save();
        } catch (logErr) {}
        
        return res.json({ prediction, advice });
      }
      
      // 4. Fallback for Fertilizer recommendation (rules-based/Gemini-based)
      if (targetPath.includes('/predict/fertilizer')) {
        const { soil_type, crop_type, nitrogen, phosphorous, potassium } = req.body;
        try {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
          const prompt = `You are a professional agricultural soil scientist. Recommend a fertilizer recommendation based on the following soil chemistry metrics:
          Soil Type: ${soil_type}
          Crop Type: ${crop_type}
          Nitrogen (N): ${nitrogen}
          Phosphorous (P): ${phosphorous}
          Potassium (K): ${potassium}
          
          Respond ONLY with a valid JSON object containing the keys "recommendation" (the name of the recommended fertilizer, e.g. Urea, DAP, NPK 14-35-14, NPK 10-26-26, etc.) and "guidelines" (1-2 sentences of usage advice). Do not include markdown code block formatting.`;
          
          const geminiRes = await axios.post(geminiUrl, {
            contents: [{ parts: [{ text: prompt }] }]
          });
          let textResponse = geminiRes.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
          textResponse = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
          const result = JSON.parse(textResponse);
          
          // Log fallback action
          const Log = require('./models/Log');
          try {
            await new Log({ userId: req.user.id, action: 'Used Fertilizer Advisor' }).save();
          } catch (logErr) {}
          
          return res.json(result);
        } catch (err) {
          // simple rule-based fallback if Gemini fails
          return res.json({
            recommendation: "NPK 14-35-14",
            guidelines: "Apply recommended compound fertilizer to supply balanced nitrogen, phosphorus and potash to the crops."
          });
        }
      }
      
      // 5. Fallback for Subsidies matcher (parse the local CSV)
      if (targetPath.includes('/predict/subsidies')) {
        const fs = require('fs');
        const csvPath = path.join(__dirname, '..', 'ml_service', 'data', 'subsidies.csv');
        if (fs.existsSync(csvPath)) {
          try {
            const csvData = fs.readFileSync(csvPath, 'utf8');
            const lines = csvData.split('\n').filter(l => l.trim());
            
            const userState = (req.body.state || '').trim().toLowerCase();
            const userCrop = (req.body.crop || '').trim().toLowerCase();
            const userLand = parseFloat(req.body.land_acres || 0);
            const userIncome = parseFloat(req.body.income || 0);
            
            const eligible_subsidies = [];
            for (let i = 1; i < lines.length; i++) {
              const cols = lines[i].split(',');
              if (cols.length >= 6) {
                const scheme = cols[0].replace(/"/g, '');
                const state = cols[1].replace(/"/g, '');
                const category = cols[2].replace(/"/g, '');
                const crop = cols[3].replace(/"/g, '');
                const maxLand = parseFloat(cols[4]);
                const maxIncome = parseFloat(cols[5]);
                const amount = parseInt(cols[6] || 5000);
                const description = cols.slice(7).join(',').replace(/"/g, '') || "Government subsidy scheme support.";
                
                const state_match = !userState || userState === 'all' || state.toLowerCase() === 'all' || state.toLowerCase() === userState;
                const crop_match = !userCrop || userCrop === 'all' || crop.toLowerCase() === 'all' || crop.toLowerCase() === userCrop;
                const land_match = userLand <= maxLand;
                const income_match = userIncome <= maxIncome;
                
                let score = 0;
                if (state_match) score += 25;
                if (crop_match) score += 25;
                if (land_match) score += 25;
                if (income_match) score += 25;
                
                const is_eligible = state_match && crop_match && land_match && income_match;
                
                eligible_subsidies.push({
                  scheme,
                  subsidy_amount: amount,
                  category,
                  description,
                  match_percentage: score,
                  is_eligible
                });
              }
            }
            
            eligible_subsidies.sort((a, b) => {
              if (a.is_eligible && !b.is_eligible) return -1;
              if (!a.is_eligible && b.is_eligible) return 1;
              return b.match_percentage - a.match_percentage;
            });
            
            // Log fallback action
            const Log = require('./models/Log');
            try {
              await new Log({ userId: req.user.id, action: 'Matched Subsidies' }).save();
            } catch (logErr) {}
            
            return res.json({ subsidies: eligible_subsidies });
          } catch (csvErr) {
            console.error("Error parsing subsidies CSV:", csvErr.message);
          }
        }
      }
    }

    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ message: 'ML service is currently unreachable' });
    }
  }
});

// (Optional) Protected API route example
app.get('/api/dashboard', jwtAuth, async (req, res) => {
  try {
    const User = require('./models/User');
    const Log = require('./models/Log');
    const user = await User.findById(req.user.id).select('-password');
    const logs = await Log.find({ userId: req.user.id }).sort({ timestamp: -1 });
    res.json({ user, logs });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Default status health-check endpoint
app.get('/', (req, res) => {
  res.json({ message: 'AgroMitra API Server is running' });
});

app.get('/health', (req, res) => {
  res.json({ message: 'AgroMitra API Server is running' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
