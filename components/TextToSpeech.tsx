import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { decode, decodeAudioData, encodeWAV } from '../utils';
import { useLanguage } from '../LanguageContext';
import { translations } from '../translations';

const LoadingSpinner = () => (
    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
);

const PlayIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8"><path d="M8 5v14l11-7z" /></svg>;
const StopIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8"><path d="M6 6h12v12H6z" /></svg>;
const DownloadIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>;


const PREBUILT_VOICES = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'];

const TextToSpeech: React.FC = () => {
    const { t, language } = useLanguage();
    const [text, setText] = useState<string>('');
    const [selectedVoice, setSelectedVoice] = useState<string>('Zephyr');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const audioContextRef = useRef<AudioContext | null>(null);
    const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
    const audioBufferRef = useRef<AudioBuffer | null>(null);
    
    useEffect(() => {
        const defaultEn = translations.en.tts_default_text;
        const defaultAr = translations.ar.tts_default_text;
        if (text === '' || text === defaultEn || text === defaultAr) {
            setText(t('tts_default_text'));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [language, t]);

    const stopPlayback = () => {
        if (audioSourceRef.current) {
            audioSourceRef.current.stop();
            audioSourceRef.current.disconnect();
            audioSourceRef.current = null;
        }
        setIsPlaying(false);
    };

    const handleGenerateSpeech = async () => {
        if (!text.trim()) {
            setError(t('tts_error_empty_text'));
            return;
        }
        
        stopPlayback();
        setIsLoading(true);
        setError(null);
        audioBufferRef.current = null;

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash-preview-tts",
                contents: [{ parts: [{ text: text }] }],
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: selectedVoice },
                        },
                    },
                },
            });

            const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
                if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
                    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
                }
                const decodedAudio = decode(base64Audio);
                audioBufferRef.current = await decodeAudioData(decodedAudio, audioContextRef.current, 24000, 1);
            } else {
                throw new Error(t('tts_error_no_audio'));
            }
        } catch (e: any) {
            setError(e.message || t('tts_error_unknown'));
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handlePlayPause = () => {
        if (isPlaying) {
            stopPlayback();
        } else if (audioBufferRef.current && audioContextRef.current) {
            if (audioContextRef.current.state === 'suspended') {
                audioContextRef.current.resume();
            }
            const source = audioContextRef.current.createBufferSource();
            source.buffer = audioBufferRef.current;
            source.connect(audioContextRef.current.destination);
            source.start();
            source.onended = () => setIsPlaying(false);
            audioSourceRef.current = source;
            setIsPlaying(true);
        }
    };
    
    const handleDownloadAudio = () => {
        if (!audioBufferRef.current) return;
        const pcmData = audioBufferRef.current.getChannelData(0);
        const wavBlob = encodeWAV(pcmData, audioBufferRef.current.sampleRate);
        const url = URL.createObjectURL(wavBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'speech.wav';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="max-w-3xl mx-auto">
            <div className="flex justify-center mb-6 opacity-30">
                 <svg xmlns="http://www.w3.org/2000/svg" className="w-28 h-28" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
            </div>
            <h2 className="text-4xl font-bold mb-8 text-center font-cairo">{t('tts_title')}</h2>
            
            <div className="space-y-8">
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={t('tts_placeholder')}
                    className="w-full h-40 p-4 bg-black/20 border border-white/20 rounded-2xl text-lg resize-none focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />

                <div>
                    <label htmlFor="voice-select" className="block text-lg font-medium text-gray-300 mb-2">{t('tts_select_voice')}</label>
                    <select
                        id="voice-select"
                        value={selectedVoice}
                        onChange={(e) => setSelectedVoice(e.target.value)}
                        className="w-full p-4 bg-black/20 border border-white/20 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-lg"
                    >
                        {PREBUILT_VOICES.map(voice => (
                            <option key={voice} value={voice}>{voice}</option>
                        ))}
                    </select>
                </div>

                {error && <p className="text-red-400 text-lg text-center">{error}</p>}

                <div className="flex items-center gap-4">
                    <button
                        onClick={handleGenerateSpeech}
                        disabled={isLoading}
                        className="flex-1 flex items-center justify-center gap-3 px-4 py-4 bg-blue-600 text-white font-semibold rounded-2xl hover:bg-blue-700 disabled:bg-blue-800/80 disabled:cursor-not-allowed transition-colors text-xl"
                    >
                        {isLoading ? <LoadingSpinner /> : t('tts_generate_button')}
                    </button>
                    <button
                        onClick={handlePlayPause}
                        disabled={!audioBufferRef.current || isLoading}
                        className="flex items-center justify-center w-16 h-16 bg-green-600 text-white rounded-2xl hover:bg-green-700 disabled:bg-white/20 disabled:cursor-not-allowed transition-colors"
                        aria-label={isPlaying ? "Stop" : "Play"}
                    >
                        {isPlaying ? <StopIcon /> : <PlayIcon />}
                    </button>
                    <button
                        onClick={handleDownloadAudio}
                        disabled={!audioBufferRef.current || isLoading}
                        className="flex items-center justify-center w-16 h-16 bg-purple-600 text-white rounded-2xl hover:bg-purple-700 disabled:bg-white/20 disabled:cursor-not-allowed transition-colors"
                        aria-label={t('download_audio')}
                        title={t('download_audio')}
                    >
                       <DownloadIcon />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TextToSpeech;