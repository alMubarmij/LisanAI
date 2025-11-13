import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { decode, decodeAudioData, createPcmBlob } from '../utils';
import { useLanguage } from '../LanguageContext';

const MicrophoneIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.49 6-3.31 6-6.72h-1.7z" /></svg>;
const StopIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10"><path d="M6 6h12v12H6V6z" /></svg>;
const DownloadIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>;


interface Transcription {
    author: 'user' | 'model';
    text: string;
}

const ConversationalAI: React.FC = () => {
    const { t, language } = useLanguage();
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
    const [status, setStatus] = useState<string>('');

    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const nextStartTimeRef = useRef<number>(0);
    const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

    const transcriptionsRef = useRef<Transcription[]>([]);
    const lastAuthorRef = useRef<'user' | 'model' | null>(null);


    const stopConversation = useCallback(async () => {
        setIsRecording(false);
        setStatus(t('status_idle'));

        scriptProcessorRef.current?.disconnect();
        scriptProcessorRef.current = null;
        mediaStreamSourceRef.current?.disconnect();
        mediaStreamSourceRef.current = null;
        
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            await audioContextRef.current.close();
        }
        if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
            await outputAudioContextRef.current.close();
        }
        
        if (sessionPromiseRef.current) {
            try {
                const session = await sessionPromiseRef.current;
                session.close();
            } catch (e) {
                console.error("Error closing session:", e);
            }
            sessionPromiseRef.current = null;
        }

        for (const source of audioSourcesRef.current.values()) {
            try {
                source.stop();
            } catch(e) { /* Already stopped */ }
        }
        audioSourcesRef.current.clear();
    }, [t]);

    useEffect(() => {
        if (!isRecording) {
            setStatus(t('status_idle'));
        }
    }, [isRecording, t]);
    
    useEffect(() => {
        if (isRecording) {
            stopConversation();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [language]);


    const startConversation = async () => {
        setIsRecording(true);
        setStatus(t('status_connecting'));
        setTranscriptions([]);
        transcriptionsRef.current = [];
        lastAuthorRef.current = null;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            nextStartTimeRef.current = 0;
            
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
                    },
                    systemInstruction: t('conversation_system_prompt'),
                },
                callbacks: {
                    onopen: () => {
                        setStatus(t('status_connected'));
                        mediaStreamSourceRef.current = audioContextRef.current!.createMediaStreamSource(stream);
                        scriptProcessorRef.current = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
                        
                        scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob = createPcmBlob(inputData);
                            sessionPromiseRef.current?.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        mediaStreamSourceRef.current.connect(scriptProcessorRef.current);
                        scriptProcessorRef.current.connect(audioContextRef.current!.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        let transcriptionUpdated = false;

                        if (message.serverContent?.inputTranscription) {
                            const text = message.serverContent.inputTranscription.text;
                            if (text) {
                                transcriptionUpdated = true;
                                if (lastAuthorRef.current !== 'user') {
                                    transcriptionsRef.current.push({ author: 'user', text: '' });
                                    lastAuthorRef.current = 'user';
                                }
                                transcriptionsRef.current[transcriptionsRef.current.length - 1].text += text;
                            }
                        }

                        if (message.serverContent?.outputTranscription) {
                            const text = message.serverContent.outputTranscription.text;
                            if (text) {
                                transcriptionUpdated = true;
                                if (lastAuthorRef.current !== 'model') {
                                    transcriptionsRef.current.push({ author: 'model', text: '' });
                                    lastAuthorRef.current = 'model';
                                }
                                transcriptionsRef.current[transcriptionsRef.current.length - 1].text += text;
                            }
                        }

                        if (transcriptionUpdated) {
                            setTranscriptions([...transcriptionsRef.current]);
                        }
                        
                        if (message.serverContent?.turnComplete) {
                            lastAuthorRef.current = null;
                        }

                        const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                        if (base64Audio && outputAudioContextRef.current) {
                            const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContextRef.current, 24000, 1);
                            const source = outputAudioContextRef.current.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outputAudioContextRef.current.destination);
                            
                            const currentTime = outputAudioContextRef.current.currentTime;
                            const startTime = Math.max(currentTime, nextStartTimeRef.current);
                            source.start(startTime);
                            nextStartTimeRef.current = startTime + audioBuffer.duration;
                            audioSourcesRef.current.add(source);
                            source.onended = () => audioSourcesRef.current.delete(source);
                        }

                        if (message.serverContent?.interrupted) {
                            for (const source of audioSourcesRef.current.values()) {
                                source.stop();
                            }
                            audioSourcesRef.current.clear();
                            nextStartTimeRef.current = 0;
                        }
                    },
                    onerror: (e: any) => {
                        setStatus(t('status_error', e.message));
                        console.error('API Error:', e);
                        stopConversation();
                    },
                    onclose: () => {
                        setStatus(t('status_closed'));
                    },
                },
            });

        } catch (error) {
            setStatus(t('status_mic_error'));
            console.error('Microphone error:', error);
            setIsRecording(false);
        }
    };
    
    const handleDownloadTranscript = () => {
        const formattedTranscript = transcriptions
            .map(t => `${t.author === 'user' ? 'User' : 'Model'}: ${t.text}`)
            .join('\n\n');
        
        const blob = new Blob([formattedTranscript], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'transcript.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    useEffect(() => {
        return () => {
            if (isRecording) {
                stopConversation();
            }
        };
    }, [isRecording, stopConversation]);

    return (
        <div className="flex flex-col h-full">
            <div className="mb-6 text-center">
                <div className="flex justify-center items-center gap-4">
                    <p className="text-3xl font-bold text-gray-100 font-cairo">{t('conversation_title')}</p>
                    {transcriptions.length > 0 && (
                        <button
                            onClick={handleDownloadTranscript}
                            title={t('download_transcript')}
                            className="p-2 rounded-full text-gray-300 hover:bg-white/20 hover:text-white transition-colors"
                        >
                            <DownloadIcon />
                        </button>
                    )}
                </div>
                <p className="text-lg text-gray-400 h-6 mt-2">{status}</p>
            </div>
            
            <div className="flex-grow bg-black/30 rounded-2xl p-4 mb-6 overflow-y-auto border border-white/20 space-y-4">
                {transcriptions.map((t, i) => (
                    <div key={i} className={`flex ${t.author === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-md lg:max-w-2xl px-5 py-3 rounded-3xl ${t.author === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-700/80 text-gray-200'}`}>
                           <p className="text-lg">{t.text}</p>
                        </div>
                    </div>
                ))}
                {transcriptions.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
                         <svg xmlns="http://www.w3.org/2000/svg" className="w-28 h-28 mb-4 opacity-20" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
                        <p className="text-xl">{t('transcript_placeholder')}</p>
                    </div>
                )}
            </div>

            <div className="flex justify-center">
                <button
                    onClick={isRecording ? stopConversation : startConversation}
                    className={`flex items-center justify-center w-24 h-24 rounded-full text-white transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-opacity-50 shadow-lg ${
                        isRecording ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                    }`}
                >
                    {isRecording ? <StopIcon /> : <MicrophoneIcon />}
                </button>
            </div>
        </div>
    );
};

export default ConversationalAI;