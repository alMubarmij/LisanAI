import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { blobToBase64 } from '../utils';
import { useLanguage } from '../LanguageContext';
import { translations } from '../translations';


const LoadingSpinner = () => <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>;
const DownloadIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>;
const UploadIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1"><path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>;
const AnalysisPlaceholderIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="w-24 h-24 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1"><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>;


const VideoAnalysis: React.FC = () => {
    const { t, language } = useLanguage();
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [prompt, setPrompt] = useState<string>('');
    const [analysis, setAnalysis] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState<string>('');

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const defaultEn = translations.en.video_default_prompt;
        const defaultAr = translations.ar.video_default_prompt;
        if (prompt === '' || prompt === defaultEn || prompt === defaultAr) {
            setPrompt(t('video_default_prompt'));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [language, t]);

    useEffect(() => {
        if (videoFile) {
            const url = URL.createObjectURL(videoFile);
            setVideoUrl(url);
            return () => URL.revokeObjectURL(url);
        } else {
            setVideoUrl(null);
        }
    }, [videoFile]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setVideoFile(file);
            setAnalysis('');
            setError(null);
        }
    };
    
    const extractFrames = async (video: HTMLVideoElement, canvas: HTMLCanvasElement): Promise<string[]> => {
        return new Promise((resolve) => {
            const frames: string[] = [];
            video.currentTime = 0;
            
            const onSeeked = async () => {
                const ctx = canvas.getContext('2d');
                if(!ctx) return resolve([]);

                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
                
                const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg'));
                if (blob) {
                    const base64 = await blobToBase64(blob);
                    frames.push(base64);
                }

                if (video.currentTime < video.duration) {
                    video.currentTime += 1; // extract one frame per second
                } else {
                    video.removeEventListener('seeked', onSeeked);
                    resolve(frames);
                }
            };
            
            video.addEventListener('seeked', onSeeked);
        });
    };

    const handleAnalyze = async () => {
        if (!videoFile || !prompt.trim() || !videoRef.current || !canvasRef.current || !videoUrl) {
            setError(t('video_error_no_file_prompt'));
            return;
        }
        
        setIsLoading(true);
        setError(null);
        setAnalysis('');
        setProgress(t('video_progress_preparing'));

        videoRef.current.src = videoUrl;
        
        videoRef.current.onloadeddata = async () => {
            try {
                setProgress(t('video_progress_extracting'));
                const frames = await extractFrames(videoRef.current!, canvasRef.current!);

                if(frames.length === 0) {
                    throw new Error(t('video_error_no_frames'));
                }

                setProgress(t('video_progress_sending', frames.length));
                
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
                
                const imageParts = frames.map(frame => ({
                    inlineData: {
                        mimeType: 'image/jpeg',
                        data: frame,
                    },
                }));
                
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-pro',
                    contents: { parts: [{ text: prompt }, ...imageParts] }
                });

                setAnalysis(response.text);

            } catch (e: any) {
                setError(e.message || t('video_error_unknown'));
                console.error(e);
            } finally {
                setIsLoading(false);
                setProgress('');
            }
        };
    };
    
    const handleDownloadAnalysis = () => {
        if (!analysis) return;
        
        const blob = new Blob([analysis], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'video-analysis.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="h-full">
            <h2 className="text-4xl font-bold mb-8 text-center font-cairo">{t('video_title')}</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
                {/* Left Column */}
                <div className="space-y-6 flex flex-col">
                     <div>
                        <label htmlFor="video-upload" className="block text-lg font-medium text-gray-300 mb-2">{t('video_upload_label')}</label>
                        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-500 border-dashed rounded-2xl cursor-pointer hover:border-blue-400 transition-colors">
                            <div className="space-y-1 text-center">
                                <UploadIcon />
                                <div className="flex text-lg text-gray-400">
                                    <p className="relative bg-black/10 rounded-md font-medium text-blue-400 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
                                        <span>{t('video_drop_zone')}</span>
                                        <input id="video-upload" name="video-upload" type="file" className="sr-only" accept="video/*" onChange={handleFileChange} />
                                    </p>
                                </div>
                                <p className="text-base text-gray-500">{t('video_drop_zone_sub')}</p>
                            </div>
                        </div>
                    </div>

                    {videoUrl && videoFile && (
                        <div>
                             <h3 className="block text-lg font-medium text-gray-300 mb-2">{t('video_preview_title')}</h3>
                            <div className="bg-black/30 p-2 rounded-2xl border border-white/20">
                                <video controls muted className="w-full rounded-xl" src={videoUrl}></video>
                                <p className="text-base text-gray-400 mt-2 px-1 truncate">{videoFile.name}</p>
                            </div>
                        </div>
                    )}

                    <div className="flex-grow flex flex-col">
                        <label htmlFor="prompt" className="block text-lg font-medium text-gray-300 mb-2">{t('video_prompt_label')}</label>
                        <textarea
                            id="prompt"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder={t('video_prompt_placeholder')}
                            className="w-full flex-grow p-4 bg-black/20 border border-white/20 rounded-2xl text-lg resize-none focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                    </div>
                     <button
                        onClick={handleAnalyze}
                        disabled={isLoading || !videoFile}
                        className="w-full flex items-center justify-center gap-3 px-4 py-4 bg-blue-600 text-white font-semibold rounded-2xl hover:bg-blue-700 disabled:bg-white/20 disabled:cursor-not-allowed transition-colors text-xl"
                    >
                        {isLoading ? <LoadingSpinner /> : t('video_analyze_button')}
                    </button>
                </div>

                {/* Right Column */}
                <div className="bg-black/30 p-4 rounded-2xl border border-white/20 flex flex-col">
                     {(isLoading || error || analysis) ? (
                        <div className="flex flex-col h-full">
                            {isLoading && <p className="text-center text-blue-400 text-lg my-4">{progress}</p>}
                            {error && <p className="text-center text-red-400 text-lg my-4">{error}</p>}
                            {analysis && (
                                <div className="flex-grow overflow-y-auto">
                                    <div className="flex justify-between items-center mb-4">
                                       <h3 className="text-2xl font-bold font-cairo">{t('video_analysis_result_title')}</h3>
                                        <button
                                            onClick={handleDownloadAnalysis}
                                            title={t('download_analysis')}
                                            className="p-2 rounded-full text-gray-300 hover:bg-white/20 hover:text-white transition-colors"
                                        >
                                            <DownloadIcon />
                                        </button>
                                    </div>
                                    <p className="text-gray-200 whitespace-pre-wrap text-lg leading-relaxed">{analysis}</p>
                                </div>
                            )}
                        </div>
                     ) : (
                         <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 p-6">
                             <AnalysisPlaceholderIcon />
                             <h3 className="text-2xl font-cairo mt-4 font-bold">{t('video_analysis_placeholder_title')}</h3>
                             <p className="text-lg mt-2">{t('video_analysis_placeholder_desc')}</p>
                         </div>
                     )}
                </div>
            </div>
            
            <video ref={videoRef} className="hidden" crossOrigin="anonymous"></video>
            <canvas ref={canvasRef} className="hidden"></canvas>
        </div>
    );
};

export default VideoAnalysis;