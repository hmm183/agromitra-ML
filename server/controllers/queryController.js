const ContactQuery = require('../models/ContactQuery');
const Log = require('../models/Log');
const axios = require('axios');

exports.createQuery = async (req, res) => {
  const { name, email, subject, message } = req.body;
  
  const queryName = name || (req.user ? req.user.username : '');
  const queryEmail = email || (req.user ? req.user.email : '');

  if (!queryName || !queryEmail || !message) {
    return res.status(400).json({ message: 'Name, Email, and Message are required' });
  }

  try {
    const newQuery = await ContactQuery.create({
      name: queryName.trim(),
      email: queryEmail.trim(),
      subject: (subject || '').trim(),
      message: message.trim()
    });

    // Log this action
    if (req.user) {
      await new Log({
        userId: req.user.id,
        action: `Submitted support query: "${(subject || message).substring(0, 40)}..."`
      }).save();
    }

    res.status(201).json({ message: 'Inquiry submitted successfully', query: newQuery });
  } catch (error) {
    console.error('Error creating inquiry:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getQueries = async (req, res) => {
  try {
    const queries = await ContactQuery.find({}).sort({ createdAt: -1 });
    res.status(200).json({ queries });
  } catch (error) {
    console.error('Error fetching inquiries:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.answerQuery = async (req, res) => {
  const { answer, approvedForSearch } = req.body;
  if (!answer) {
    return res.status(400).json({ message: 'Answer is required' });
  }

  try {
    const query = await ContactQuery.findById(req.params.id);
    if (!query) {
      return res.status(404).json({ message: 'Inquiry not found' });
    }

    query.answer = answer.trim();
    query.status = 'Answered';
    query.approvedForSearch = approvedForSearch === true || approvedForSearch === 'true';
    await query.save();

    // Log action
    await new Log({
      userId: req.user.id,
      action: `Answered query ID: ${req.params.id} (Approved for search: ${query.approvedForSearch})`
    }).save();

    res.status(200).json({ message: 'Query answered successfully', query });
  } catch (error) {
    console.error('Error answering query:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteQuery = async (req, res) => {
  try {
    const query = await ContactQuery.findById(req.params.id);
    if (!query) {
      return res.status(404).json({ message: 'Inquiry not found' });
    }
    await ContactQuery.findByIdAndDelete(req.params.id);

    await new Log({
      userId: req.user.id,
      action: `Deleted query ID: ${req.params.id}`
    }).save();

    res.status(200).json({ message: 'Query deleted successfully' });
  } catch (error) {
    console.error('Error deleting query:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// AI Optimizer using Gemini-2.5-flash
exports.optimizeQuery = async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ message: 'Message is required for AI optimization' });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ message: 'Gemini API key is not configured' });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const prompt = `You are an expert agricultural assistant for the AgroMitra platform. Optimize the following customer/farmer inquiry for an FAQ search index.
First, correct any spelling or grammatical errors in the user's question, making it sound professional, clear, and concise.
Second, write a helpful, detailed, and agriculturally sound answer (in English) that addresses the inquiry.
Reply ONLY with a raw JSON object containing the keys "optimizedQuestion" and "optimizedAnswer". Do not include markdown code block formatting (like \`\`\`json).

User Question: "${message}"`;

    const response = await axios.post(url, {
      contents: [
        {
          parts: [
            { text: prompt }
          ]
        }
      ]
    });

    let textResponse = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textResponse) {
      throw new Error('Empty response from Gemini API');
    }

    // Clean up potential markdown formatting if Gemini included it
    textResponse = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(textResponse);

    res.status(200).json({
      optimizedQuestion: result.optimizedQuestion,
      optimizedAnswer: result.optimizedAnswer
    });
  } catch (error) {
    console.error('Error optimizing query with Gemini:', error.message);
    res.status(500).json({ 
      message: 'Failed to optimize query with AI', 
      details: error.message 
    });
  }
};

// AI Direct Query Assistant using Gemini-2.5-flash with Off-Topic Filtering and In-Depth Mode
exports.askGemini = async (req, res) => {
  const { query, inDepth } = req.body;
  if (!query) {
    return res.status(400).json({ message: 'Query is required' });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ message: 'Gemini API key is not configured' });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    let promptDetail = "answer their question in a friendly, helpful, and concise manner in English. Keep it direct and relatively short.";
    if (inDepth) {
      promptDetail = "answer their question in a friendly, highly detailed, comprehensive, and in-depth manner in English. Provide detailed explanation, steps, and structure where relevant.";
    }

    const prompt = `You are the AgroMitra AI Assistant, a helpful support chatbot for the AgroMitra agricultural platform.
The user is asking: "${query}".

If the question is completely off-topic (meaning it is NOT related to agriculture, farming, crops, soil, fertilizer, weather, Mandi prices, government agricultural schemes/subsidies, or the AgroMitra platform, its features, or developers Vrishank Raina and Raushan Shrivastawa), you MUST start your response with "OFFTOPIC:" followed by a polite explanation that you can only answer questions related to agriculture, farming, and the AgroMitra platform.

Otherwise, ${promptDetail}`;

    const response = await axios.post(url, {
      contents: [
        {
          parts: [
            { text: prompt }
          ]
        }
      ]
    });

    let answer = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!answer) {
      throw new Error('Empty response from Gemini API');
    }

    answer = answer.replace(/```[a-z]*/g, '').trim();

    let isOffTopic = false;
    if (answer.toUpperCase().startsWith('OFFTOPIC:')) {
      isOffTopic = true;
      answer = answer.substring('OFFTOPIC:'.length).trim();
    }

    res.status(200).json({ answer, isOffTopic });
  } catch (error) {
    console.error('Error asking Gemini:', error.message);
    res.status(500).json({ 
      message: 'Failed to get answer from AI', 
      details: error.message 
    });
  }
};



