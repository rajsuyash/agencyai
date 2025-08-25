import React, { useState, useMemo } from 'react';
import { Bot, Sparkles, Image as ImageIcon, Loader2, AlertTriangle } from 'lucide-react';

// Main App Component
export default function App() {
  // --- STATE MANAGEMENT ---
  const [apiKey, setApiKey] = useState(''); // Keep API key in state
  const [brief, setBrief] = useState(
    'Client: "Aqua Pura" - a new premium bottled water brand. Target Audience: Health-conscious millennials (25-40). Core Challenge: Differentiate in a saturated market. Key Message: "Experience purity in every drop." Mandatories: Must feature natural elements, convey a sense of calm and refreshment. Budget: High-end campaign.'
  );
  const [creativity, setCreativity] = useState(0.7);
  const [concepts, setConcepts] = useState([]);
  const [isLoadingIdeas, setIsLoadingIdeas] = useState(false);
  const [loadingImageId, setLoadingImageId] = useState(null);
  const [error, setError] = useState(null);

  // --- API CALLS with Exponential Backoff ---
  const fetchWithBackoff = async (url, options, maxRetries = 5) => {
    let delay = 1000; // start with 1 second
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(url, options);
        if (response.ok) {
          return response.json();
        } else if (response.status === 429) { // Too Many Requests
          // Exponential backoff
          await new Promise(res => setTimeout(res, delay));
          delay *= 2;
        } else {
          const errData = await response.json();
          throw new Error(errData.error?.message || `HTTP error! status: ${response.status}`);
        }
      } catch (e) {
        if (i === maxRetries - 1) throw e;
        await new Promise(res => setTimeout(res, delay));
        delay *= 2;
      }
    }
    throw new Error("Request failed after multiple retries.");
  };

  // --- CORE FUNCTIONS ---

  /**
   * Generates campaign concepts using the Gemini API based on the creative brief.
   */
  const generateIdeas = async () => {
    if (!brief) {
      setError('Please enter a creative brief.');
      return;
    }
    setIsLoadingIdeas(true);
    setError(null);
    setConcepts([]);

    const creativityLevels = {
      0: 'strictly conventional and brand-safe',
      0.25: 'conventional with a slight creative touch',
      0.5: 'a balance of creative and conventional',
      0.75: 'highly creative and artistic',
      1: 'wildly unorthodox and experimental, pushing all boundaries',
    };

    const prompt = `
      You are an expert Creative Director at a top-tier advertising agency.
      Based on the following creative brief, generate 5 distinct campaign concepts.
      Each concept must have a catchy headline and a short, compelling paragraph (2-3 sentences) explaining the core idea.
      The tone of the concepts should be ${creativityLevels[creativity]}.

      Creative Brief:
      ---
      ${brief}
      ---

      Format your response as a numbered list (1., 2., 3., etc.). Do not include any other text before or after the list.
    `;
    
    const chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
    const payload = { contents: chatHistory };
    const apiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`; // Updated model and API version

    try {
      const result = await fetchWithBackoff(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error("Invalid response structure from API.");
      }
      
      const parsedConcepts = text
        .split(/\d+\.\s+/)
        .filter(c => c.trim().length > 0)
        .map((conceptText, index) => ({
          id: Date.now() + index,
          text: conceptText.trim(),
          imageUrl: null,
        }));
      setConcepts(parsedConcepts);
    } catch (err) {
      console.error('Error generating ideas:', err);
      setError(`Failed to generate ideas. ${err.message}`);
    } finally {
      setIsLoadingIdeas(false);
    }
  };

  /**
   * Generates a visual for a specific concept using the Imagen API.
   * @param {number} conceptId - The ID of the concept to visualize.
   * @param {string} conceptText - The text of the concept.
   */
  const visualizeConcept = async (conceptId, conceptText) => {
    setLoadingImageId(conceptId);
    setError(null);

    const prompt = `
      Create a stunning, photorealistic, cinematic advertisement image for the following campaign concept.
      The image should be high-resolution, emotionally resonant, and visually striking, suitable for a major brand campaign.
      Focus on the visual essence of the idea.

      Concept:
      ---
      ${conceptText}
      ---
    `;

    const payload = { instances: [{ prompt: prompt }], parameters: { "sampleCount": 1} };
    const apiUrl = `https://us-central1-aiplatform.googleapis.com/v1/projects/gemini-429018/locations/us-central1/publishers/google/models/imagen-3.0-generate-002:predict?key=${apiKey}`;

    try {
        const result = await fetchWithBackoff(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (result.predictions && result.predictions.length > 0 && result.predictions[0].bytesBase64Encoded) {
            const imageUrl = `data:image/png;base64,${result.predictions[0].bytesBase64Encoded}`;
            setConcepts(prevConcepts =>
                prevConcepts.map(c => (c.id === conceptId ? { ...c, imageUrl } : c))
            );
        } else {
            throw new Error("No image data received from API.");
        }

    } catch (err) {
      console.error('Error visualizing concept:', err);
      setError(`Failed to generate image. ${err.message}`);
    } finally {
      setLoadingImageId(null);
    }
  };
  
  // --- UI COMPONENTS ---

  const CreativitySlider = () => {
    const levels = [
      { value: 0, label: 'Conventional' },
      { value: 0.5, label: 'Balanced' },
      { value: 1, label: 'Unorthodox' },
    ];
    const color = useMemo(() => {
        const r = Math.round(255 * (1 - creativity));
        const g = Math.round(200 * creativity);
        const b = 200;
        return `rgb(${r}, ${g}, ${b})`;
    }, [creativity]);

    return (
      <div className="w-full">
        <label htmlFor="creativity" className="block text-sm font-medium text-gray-300 mb-2">
          Creativity Dial
        </label>
        <div className="relative">
            <input
              id="creativity"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={creativity}
              onChange={(e) => setCreativity(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              style={{
                  background: `linear-gradient(to right, #888, ${color})`
              }}
            />
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          {levels.map(level => <span key={level.value}>{level.label}</span>)}
        </div>
      </div>
    );
  };

  const ConceptCard = ({ concept }) => (
    <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 shadow-lg transition-all duration-300 hover:border-blue-500 hover:shadow-blue-500/20">
      <p className="text-gray-300 mb-4 whitespace-pre-wrap font-serif">{concept.text}</p>
      <button
        onClick={() => visualizeConcept(concept.id, concept.text)}
        disabled={loadingImageId !== null}
        className="w-full flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
      >
        {loadingImageId === concept.id ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <ImageIcon className="mr-2 h-4 w-4" />
        )}
        Visualize
      </button>
    </div>
  );
  
  const VisualCard = ({ concept }) => (
    <div className="bg-gray-900 p-4 rounded-lg border border-gray-700 aspect-w-1 aspect-h-1 flex flex-col">
       <div className="border-b border-gray-700 pb-2 mb-3">
         <h4 className="text-sm font-bold text-blue-300 truncate">{concept.text.split('\n')[0]}</h4>
       </div>
       <div className="flex-grow flex items-center justify-center bg-black rounded-md overflow-hidden">
          <img 
            src={concept.imageUrl} 
            alt="Generated visual for a concept" 
            className="object-contain w-full h-full"
          />
       </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans">
      <div className="container mx-auto p-4 md:p-8">
        {/* Header */}
        <header className="text-center mb-8 border-b border-gray-700 pb-4">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
            Catalyst AI
          </h1>
          <p className="text-gray-400 mt-2">The Agency Creative Accelerator MVP</p>
        </header>

        {/* API Key Input */}
        <div className="max-w-md mx-auto mb-8">
            <label htmlFor="api-key" className="block text-sm font-medium text-gray-300 mb-2">
                Enter Your Google AI API Key
            </label>
            <input
                id="api-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Paste your API key here"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Your key is used only for this session and not stored.</p>
        </div>
        
        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Column 1: Input */}
          <div className="lg:col-span-1 space-y-6 p-6 bg-gray-800/30 rounded-xl border border-gray-700">
            <h2 className="text-2xl font-semibold flex items-center text-gray-100">
              <span className="text-3xl mr-3">1.</span> Creative Brief
            </h2>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="Paste your client's creative brief here..."
              className="w-full h-64 p-3 bg-gray-800 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 transition-colors text-gray-300"
            />
            <CreativitySlider />
            <button
              onClick={generateIdeas}
              disabled={isLoadingIdeas || !apiKey}
              className="w-full flex items-center justify-center px-6 py-3 text-base font-bold text-white bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105"
            >
              {isLoadingIdeas ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-5 w-5" />
              )}
              Generate Ideas
            </button>
            {!apiKey && <p className="text-xs text-center text-yellow-400">API Key is required to generate ideas.</p>}
          </div>

          {/* Column 2 & 3: Output */}
          <div className="lg:col-span-2 space-y-8">
            {/* Concepts Section */}
            <div>
              <h2 className="text-2xl font-semibold flex items-center text-gray-100 mb-4">
                <span className="text-3xl mr-3">2.</span> Campaign Concepts
              </h2>
              {isLoadingIdeas && (
                <div className="flex justify-center items-center p-8 bg-gray-800/30 rounded-xl border border-dashed border-gray-600">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                  <p className="ml-4 text-gray-400">Generating brilliant ideas...</p>
                </div>
              )}
              {!isLoadingIdeas && concepts.length === 0 && (
                <div className="text-center p-8 bg-gray-800/30 rounded-xl border border-dashed border-gray-600">
                  <Bot className="mx-auto h-12 w-12 text-gray-500" />
                  <p className="mt-4 text-gray-400">Your generated campaign concepts will appear here.</p>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {concepts.map(concept => <ConceptCard key={concept.id} concept={concept} />)}
              </div>
            </div>
            
            {/* Visuals Section */}
            <div>
              <h2 className="text-2xl font-semibold flex items-center text-gray-100 mb-4">
                <span className="text-3xl mr-3">3.</span> Visual Prototypes
              </h2>
              {concepts.filter(c => c.imageUrl).length === 0 ? (
                <div className="text-center p-8 bg-gray-800/30 rounded-xl border border-dashed border-gray-600">
                  <ImageIcon className="mx-auto h-12 w-12 text-gray-500" />
                  <p className="mt-4 text-gray-400">Click "Visualize" on a concept to generate an image.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {concepts.filter(c => c.imageUrl).map(concept => <VisualCard key={concept.id} concept={concept} />)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
            <div className="fixed bottom-5 right-5 max-w-sm bg-red-900/80 border border-red-600 text-white p-4 rounded-lg shadow-2xl backdrop-blur-sm">
                <div className="flex items-start">
                    <AlertTriangle className="h-6 w-6 text-red-400 mr-3 flex-shrink-0" />
                    <div>
                        <h3 className="font-bold">An Error Occurred</h3>
                        <p className="text-sm text-red-200">{error}</p>
                    </div>
                     <button onClick={() => setError(null)} className="ml-4 text-red-300 hover:text-white">&times;</button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}